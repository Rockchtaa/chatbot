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
import { fetchCurrentAbsences, fetchProjectInfo } from './timetrack';
import crypto from 'crypto';
import { sendVerificationEmail } from './emailService';

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
        
        // Generate a unique verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');

        // Save the user with the token and verification status
        await db.insert(users).values({ 
            id: userId, 
            name: username, 
            email, 
            password: hashedPassword,
            email_verification_token: verificationToken,
            is_email_verified: false, // Explicitly set to false
        });

        // Send the confirmation email
        await sendVerificationEmail(email, username, verificationToken); 
        
        // Do NOT log the user in or return a JWT token here.
        // The user must verify their email first.

        return res.status(201).json({ 
            message: "Registration successful. Please check your email to verify your account." 
        });

    } catch (error) {
        console.error("Error registering user:", error);
        return res.status(500).json({ error: "Failed to register user" });
    }
});

// Login User
// Login User
app.post("/login", async (req: Request, res: Response): Promise<any> => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }

    try {
        const userResult = await db.select().from(users).where(eq(users.email, email));

        if (userResult.length === 0) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const user = userResult[0];

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // **CHECK VERIFICATION STATUS**
        if (!user.is_email_verified) {
            return res.status(403).json({ 
                error: "Email not verified. Please check your inbox for the verification link." 
            });
        }

        // Upsert user to Stream Chat only after successful login
        const streamUserResponse = await chatClient.queryUsers({ id: { $eq: user.id } });
        if (!streamUserResponse.users.length) {
            await chatClient.upsertUser({
                id: user.id,
                name: user.name,
                email: user.email,
                role: "user",
            });
        }

        const token = jwt.sign({ userId: user.id, username: user.name, email: user.email }, JWT_SECRET, { expiresIn: '1h' });

        return res.status(200).json({ message: "Login successful", userId: user.id, username: user.name, token });
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

// NEW ENDPOINT: Handle TimeTrack specific queries
app.post("/timetrack-query", authenticateToken, async (req: Request, res: Response): Promise<any> => {
    const { userId } = (req as any).user;
    const { queryType, projectName, conversationId } = req.body; // conversationId now optional for saving

    if (!queryType) {
        return res.status(400).json({ error: "queryType is required" });
    }

    let responseMessage = "";
    let userMessageContent = ""; // To save user's intent to db

    try {
        switch (queryType) {
            case "absences":
                userMessageContent = "I asked about workers absent/on leave.";
                responseMessage = await fetchCurrentAbsences();
                break;
            case "projects":
                userMessageContent = projectName ? `I asked about project: ${projectName}.` : "I asked about worker projects.";
                responseMessage = await fetchProjectInfo(projectName); // Pass projectName if provided
                break;
            default:
                return res.status(400).json({ error: "Invalid query type" });
        }

        // --- Conversation Saving Logic (similar to /chat) ---
        let currentConversationId = conversationId;
        let conversationTitle = "";

        // If no conversation ID, create a new one, specifically titled for TimeTrack
        if (!currentConversationId) {
            conversationTitle = `TimeTrack: ${queryType}`; // Dynamic title
            const newConversation = await db.insert(conversations).values({
                user_id: userId,
                title: conversationTitle,
                created_at: new Date(),
                updated_at: new Date(),
            }).returning({ id: conversations.id });

            if (!newConversation[0]) {
                throw new Error("Failed to create new conversation for TimeTrack query.");
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

            conversationTitle = existingConversation[0].title; // Keep original title
        }

        // Save user's "intent" message and the AI's response to the database
        await db.insert(chats).values({
            conversation_id: currentConversationId,
            message: userMessageContent, // User's message about the query
            reply: responseMessage, // AI's response from TimeTrack API
            created_at: new Date(),
        });

        return res.status(200).json({
            response: responseMessage,
            conversationId: currentConversationId,
            conversationTitle: conversationTitle
        });

    } catch (error) {
        console.error("Error in /timetrack-query:", error);
        return res.status(500).json({ error: "Failed to retrieve TimeTrack data" });
    }
});

app.get("/verify-email", async (req: Request, res: Response): Promise<any> => {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: "Verification token is missing or invalid." });
    }

    try {
        // Find the user with the matching verification token
        const user = await db.select().from(users).where(eq(users.email_verification_token, token));

        if (user.length === 0) {
            return res.status(404).json({ error: "Invalid verification token." });
        }

        // Update the user's status to verified and clear the token
        await db.update(users)
            .set({ 
                is_email_verified: true,
                email_verification_token: null // Clear the token so it can't be reused
            })
            .where(eq(users.id, user[0].id));

        // You can redirect the user to your login page or show a success message
        return res.status(200).send("<h1>Email Verified!</h1><p>Your email has been successfully verified. You can now log in.</p>");

    } catch (error) {
        console.error("Error verifying email:", error);
        return res.status(500).json({ error: "Failed to verify email." });
    }
});


const port = process.env.PORT || 8000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});