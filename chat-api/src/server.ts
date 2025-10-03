import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import { db } from "./config/database";
import { chats } from "./db/schema";
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const ANONYMOUS_USER_ID = "anonymous_user";

// Azure OpenAI configuration
const client = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_KEY!,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT!}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME!}`,
  defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION || "2024-02-01" },
  defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_KEY! },
});

// Azure Search configuration
const searchConfig = {
  searchEndpoint: process.env.AZURE_SEARCH_ENDPOINT!,
  searchKey: process.env.AZURE_SEARCH_KEY!,
  searchIndex: process.env.AZURE_SEARCH_INDEX_NAME!,
};

// Function to perform Azure Cognitive Search
async function performAzureSearch(query: string): Promise<any> {
  try {
    const searchUrl = `${searchConfig.searchEndpoint}/indexes/${searchConfig.searchIndex}/docs?api-version=2023-11-01&search=${encodeURIComponent(query)}&$top=5`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'api-key': searchConfig.searchKey!
      }
    });

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.value || [];
  } catch (error) {
    console.error('Azure Search error:', error);
    return [];
  }
}

// Enhanced chat endpoint with Azure Cognitive Search
app.post("/chat", async (req: Request, res: Response): Promise<any> => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    console.log("Received message:", message);

    // Step 1: Perform Azure Cognitive Search
    const searchResults = await performAzureSearch(message);
    console.log(`Found ${searchResults.length} search results`);

    let context = "";
    if (searchResults.length > 0) {
      // Build context from search results
      searchResults.forEach((result: any, index: number) => {
        // Extract relevant text fields - adjust based on your index schema
        const content = result.content || result.text || result.description || JSON.stringify(result);
        context += `[Source ${index + 1}]: ${content}\n\n`;
      });
    }

    // Step 2: Create the prompt with search context
    let systemMessage = "";
    let userMessage = "";

    if (searchResults.length > 0) {
      systemMessage = `You are a helpful AI assistant that answers questions based ONLY on the provided context. 
      If the answer cannot be found in the context, politely say that you don't have that information in your knowledge base.
      
      Context:
      ${context}`;
      
      userMessage = message;
    } else {
      // If no search results found, use a more restrictive system message
      systemMessage = `You are a helpful AI assistant that answers questions based ONLY on your knowledge base. 
      Since no relevant information was found in the knowledge base for this query, please respond that you cannot answer based on the available information.`;
      
      userMessage = message;
    }

    // Step 3: Call Azure OpenAI with the enhanced context
    const completion = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
      messages: [
        { 
          role: "system", 
          content: systemMessage
        },
        { role: "user", content: userMessage }
      ],
      max_tokens: 800,
      temperature: 0.3, // Lower temperature for more factual responses
    });

    const responseContent = completion.choices[0]?.message?.content || "No response from Azure OpenAI.";

    console.log("Azure OpenAI response:", responseContent);

    // Save chat message to the database
    await db.insert(chats).values({
      user_id: ANONYMOUS_USER_ID,
      message: message,
      reply: responseContent
    });

    return res.status(200).json({ 
      response: responseContent,
      searchResultsCount: searchResults.length
    });
  } catch (error: any) {
    console.error("Error in /chat:", error);
    return res.status(500).json({ 
      error: "Failed to handle chat",
      details: error.message 
    });
  }
});

// Alternative: Using REST API directly for full Azure OpenAI extensions
app.post("/chat-with-extensions", async (req: Request, res: Response): Promise<any> => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const azureUrl = `${process.env.AZURE_OPENAI_ENDPOINT!}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME!}/chat/completions?api-version=${process.env.AZURE_OPENAI_API_VERSION || "2024-02-01"}`;

    const requestBody = {
      messages: [
        {
          role: "user",
          content: message
        }
      ],
      data_sources: [
        {
          type: "azure_search",
          parameters: {
            endpoint: searchConfig.searchEndpoint,
            key: searchConfig.searchKey,
            index_name: searchConfig.searchIndex,
          }
        }
      ],
      max_tokens: 800,
      temperature: 0.3
    };

    const response = await fetch(azureUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.AZURE_OPENAI_KEY!
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Azure OpenAI request failed: ${response.statusText}`);
    }

    const data = await response.json();
    const responseContent = data.choices[0]?.message?.content || "No response from Azure OpenAI.";

    console.log("Azure OpenAI with extensions response:", responseContent);

    // Save chat message to the database
    await db.insert(chats).values({
      user_id: ANONYMOUS_USER_ID,
      message: message,
      reply: responseContent
    });

    return res.status(200).json({ 
      response: responseContent
    });
  } catch (error: any) {
    console.error("Error in /chat-with-extensions:", error);
    return res.status(500).json({ 
      error: "Failed to handle chat with extensions",
      details: error.message 
    });
  }
});


const port = process.env.PORT || 8000;

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Azure Search configured for index: ${searchConfig.searchIndex}`);
});