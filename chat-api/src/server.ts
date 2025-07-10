import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { StreamChat } from "stream-chat"; 
import { runGemini } from "./gemini";
import { db } from "./config/database";
import { chats, users, conversations } from "./db/schema"; 
import { eq, desc, and } from "drizzle-orm"; 
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const chatClient = StreamChat.getInstance(
  process.env.STREAM_API_KEY!,
  process.env.STREAM_API_SECRET!
);

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

// Middleware to verify JWT
const authenticateToken = (req: Request, res: Response, next: Function) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: "Authentication token required" });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err: jwt.VerifyErrors | null, user: any) => {
    if (err) {
      res.status(403).json({ error: "Invalid or expired token" });
      return;
    }
    (req as any).user = user;
    next();
  });
};

// Helper function to generate a conversation title
const generateConversationTitle = (message: string): string => {
    // Take the first few words, or the whole message if it's short
    const words = message.split(' ').filter(Boolean);
    if (words.length <= 5) {
        return message.substring(0, 50) + (message.length > 50 ? '...' : '');
    }
    return words.slice(0, 5).join(' ') + '...';
};


// Register User
app.post("/register", async (req: Request, res: Response): Promise<any> => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ error: "Username, email, and password are required" });
    }

    try {
        const existingUser = await db.select().from(users).where(eq(users.email, email));
        if (existingUser.length > 0) {
            return res.status(409).json({ error: "User with this email already exists" });
        }

        const userId = email.replace(/[^a-zA-Z0-9]/g, "_");
        const hashedPassword = await bcrypt.hash(password, 10);

        await db.insert(users).values({ id: userId, name: username, email, password: hashedPassword });

        const streamUserResponse = await chatClient.queryUsers({ id: { $eq: userId } });
        if (!streamUserResponse.users.length) {
            await chatClient.upsertUser({
                id: userId,
                name: username,
                email: email,
                role: "user",
            });
        }

        const token = jwt.sign({ userId, username, email }, JWT_SECRET, { expiresIn: '1h' });

        return res.status(201).json({ message: "User registered successfully", userId, username, token });
    } catch (error) {
        console.error("Error registering user:", error);
        return res.status(500).json({ error: "Failed to register user" });
    }
});

// Login User
app.post("/login", async (req: Request, res: Response): Promise<any> => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    try {
        const user = await db.select().from(users).where(eq(users.email, email));

        if (user.length === 0) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const isPasswordValid = await bcrypt.compare(password, user[0].password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ userId: user[0].id, username: user[0].name, email: user[0].email }, JWT_SECRET, { expiresIn: '1h' });

        return res.status(200).json({ message: "Login successful", userId: user[0].id, username: user[0].name, token });
    } catch (error) {
        console.error("Error logging in user:", error);
        return res.status(500).json({ error: "Failed to log in" });
    }
});

// Get all conversations for a user
app.get("/conversations", authenticateToken, async (req: Request, res: Response): Promise<any> => {
    const { userId } = (req as any).user;

    try {
        const userConversations = await db
            .select()
            .from(conversations)
            .where(eq(conversations.user_id, userId))
            .orderBy(desc(conversations.updated_at)); 

        return res.status(200).json({ conversations: userConversations });
    } catch (error) {
        console.error("Error fetching conversations:", error);
        return res.status(500).json({ error: "Failed to fetch conversations" });
    }
});

// Delete a conversation
app.delete("/conversations/:id", authenticateToken, async (req: Request, res: Response): Promise<any> => {
    const { userId } = (req as any).user;
    const conversationId = parseInt(req.params.id);

    if (isNaN(conversationId)) {
        return res.status(400).json({ error: "Invalid conversation ID" });
    }

    try {
        // Ensure the conversation belongs to the user
        const deletedConversation = await db
            .delete(conversations)
            .where(and(eq(conversations.id, conversationId), eq(conversations.user_id, userId)))
            .returning();

        if (!deletedConversation.length) {
            return res.status(404).json({ error: "Conversation not found or not owned by user" });
        }

        

        return res.status(200).json({ message: "Conversation deleted successfully", id: conversationId });
    } catch (error) {
        console.error("Error deleting conversation:", error);
        return res.status(500).json({ error: "Failed to delete conversation" });
    }
});


// Send message to Gemini and get response, creating or updating conversation
app.post("/chat", authenticateToken, async (req: Request, res: Response): Promise<any> => {
    const { userId } = (req as any).user;
    const { message, conversationId } = req.body;

    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }

    let currentConversationId = conversationId;
    let conversationTitle = "";

    try {
        // If no conversation ID, create a new one
        if (!currentConversationId) {
            conversationTitle = generateConversationTitle(message);
            const newConversation = await db.insert(conversations).values({
                user_id: userId,
                title: conversationTitle,
                created_at: new Date(),
                updated_at: new Date(),
            }).returning({ id: conversations.id });

            if (!newConversation[0]) {
                throw new Error("Failed to create new conversation.");
            }
            currentConversationId = newConversation[0].id;
        } else {
            // If conversation ID exists, ensure it belongs to the user and update its timestamp
            const existingConversation = await db.select()
                .from(conversations)
                .where(and(eq(conversations.id, currentConversationId), eq(conversations.user_id, userId)));

            if (!existingConversation.length) {
                return res.status(404).json({ error: "Conversation not found or not owned by user." });
            }

            // Update updated_at timestamp
            await db.update(conversations)
                .set({ updated_at: new Date() })
                .where(eq(conversations.id, currentConversationId));

            conversationTitle = existingConversation[0].title; 
        }

        const geminiResponse = await runGemini(message);
        console.log("Gemini response:", geminiResponse);

        // Save chat message to the database, linked to the conversation
        await db.insert(chats).values({
            conversation_id: currentConversationId,
            message: message,
            reply: geminiResponse,
            created_at: new Date(),
        });

        // Optionally, integrate with Stream Chat
        // The Stream Chat channel name could be `chat-${currentConversationId}`
        const channel = chatClient.channel("messaging", `chat-${currentConversationId}`, {
          name: conversationTitle, 
          created_by_id: "ai_bot",
        });

        await channel.create().catch((err) => {
          if (err.code !== 16) throw err;
        });

        await channel.sendMessage({
          text: geminiResponse,
          user_id: "ai_bot",
        });

        return res.status(200).json({ response: geminiResponse, conversationId: currentConversationId, conversationTitle });
    } catch (error) {
        console.error("Error in /chat:", error);
        return res.status(500).json({ error: "Failed to handle chat" });
    }
});

// Get chat history for a specific conversation
app.post("/get-messages", authenticateToken, async (req: Request, res: Response): Promise<any> => {
    const { userId } = (req as any).user;
    const { conversationId } = req.body;

    if (!conversationId) {
        return res.status(400).json({ error: "Conversation ID is required" });
    }

    try {
        // First, verify the conversation belongs to the authenticated user
        const existingConversation = await db.select()
            .from(conversations)
            .where(and(eq(conversations.id, conversationId), eq(conversations.user_id, userId)));

        if (!existingConversation.length) {
            return res.status(404).json({ error: "Conversation not found or not owned by user." });
        }

        const chatHistory = await db
            .select()
            .from(chats)
            .where(eq(chats.conversation_id, conversationId))
            .orderBy(chats.created_at);

        return res.status(200).json({ chatHistory });
    } catch (error) {
        console.error("Error fetching chat history:", error);
        return res.status(500).json({ error: "Failed to fetch chat history" });
    }
});


const port = process.env.PORT || 8000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});