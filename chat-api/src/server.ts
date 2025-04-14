import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { StreamChat } from "stream-chat";
import { runGemini } from "./gemini";
import { db } from "./config/database";
import { chats, users } from "./db/schema";
import { eq } from "drizzle-orm";
import { ChatCompletionMessageParam } from "openai/resources";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize StreamChat client with API key and secret
// Note: In a production environment, you should use environment variables to store sensitive information like API keys and secrets.
const chatClient = StreamChat.getInstance(
  process.env.STREAM_API_KEY!,
  process.env.STREAM_API_SECRET!
);

//reigster user with stream chat
app.post(
  "/register-user",
  async (req: Request, res: Response): Promise<any> => {
    const { username, email } = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: "Username and email are required" });
    }

    try {
      const userId = email.replace(/[^a-zA-Z0-9]/g, "_");

      const userResponse = await chatClient.queryUsers({
        id: { $eq: userId },
      });

      if (!userResponse.users.length) {
        // Create a new user if it doesn't exist (stream chat user)
        await chatClient.upsertUser({
          id: userId,
          name: username,
          email: email,
          role: "user",
        });
      }

      return res.status(200).json({ userId, username, email });
    } catch (error) {
      console.error("Error creating user:", error);
      return res.status(500).json({ error: "Failed to create user" });
    }
  }
);
// send message to gemini and get response
app.post("/chat", async (req: Request, res: Response): Promise<any> => {
  const { userId, message } = req.body;

  if (!userId || !message) {
    return res.status(400).json({ error: "User ID and message are required" });
  }

  try {
    const response = await chatClient.queryUsers({ id: userId });

    if (!response.users.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const geminiResponse = await runGemini(message);
    console.log("Gemini response:", geminiResponse);

    // Create or get channel
    const channel = chatClient.channel("messaging", `chat-${userId}`, {
      name: "Gemini Chat",
      created_by_id: "ai_bot",
    });

    // Create the channel if it doesn't exist
    await channel.create().catch((err) => {
      if (err.code !== 16) throw err;
    });

    // Send Gemini response to the channel
    await channel.sendMessage({
      text: geminiResponse,
      user_id: "ai_bot",
    });

    return res.status(200).json({ response: geminiResponse });
  } catch (error) {
    console.error("Error in /chat:", error);
    return res.status(500).json({ error: "Failed to handle chat" });
  }
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
