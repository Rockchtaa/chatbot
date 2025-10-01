import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { runGemini } from "./gemini";
import { db } from "./config/database";
import { chats } from "./db/schema";
import { eq, desc } from "drizzle-orm";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Use a default anonymous user ID
const ANONYMOUS_USER_ID = "anonymous_user";

// Send message to gemini and get response
app.post("/chat", async (req: Request, res: Response): Promise<any> => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const geminiResponse = await runGemini(message);
    console.log("Gemini response:", geminiResponse);

    // Save chat message to the database
    await db.insert(chats).values({ 
      user_id: ANONYMOUS_USER_ID, 
      message: message, 
      reply: geminiResponse 
    });

    return res.status(200).json({ response: geminiResponse });
  } catch (error) {
    console.error("Error in /chat:", error);
    return res.status(500).json({ error: "Failed to handle chat" });
  }
});

// Get chat history
app.get("/get-messages", async (req: Request, res: Response): Promise<any> => {
  try { 
    const chatHistory = await db
      .select()
      .from(chats)
      .where(eq(chats.user_id, ANONYMOUS_USER_ID))
      .orderBy(desc(chats.created_at));

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