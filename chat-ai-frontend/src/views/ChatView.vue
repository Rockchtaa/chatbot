<script setup>
import { useUserStore } from '../stores/user';
import { useChatStore } from '../stores/chat';
import { useRouter } from 'vue-router';
import Header from '../components/Header.vue';
import { onMounted, nextTick, watch } from 'vue';

const userStore = useUserStore();
const chatStore = useChatStore();
const router = useRouter();

const scrollToBottom = () => {
  nextTick(() => {
    const chatContainer = document.getElementById('chat-container');
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
  });
};

onMounted(() => {
  // Load conversations first, then messages for the selected/first conversation
  chatStore.loadConversations().then(() => {
    // messages for the active conversation will be loaded by setActiveConversation
    scrollToBottom();
  });
});

// Watch for changes in messages to scroll to bottom automatically
watch(chatStore.messages, () => {
  scrollToBottom();
}, { deep: true });

// Watch for changes in currentConversationId to potentially clear messages
// This is already implicitly handled by setActiveConversation calling loadChatMessages,
// but good to ensure if needed.
// watch(chatStore.currentConversationId, () => {
//   if (chatStore.currentConversationId === null) {
//     chatStore.messages = []; // Clear messages for new conversation
//   }
// });
</script>

<template>
  <div class="flex flex-col h-screen bg-gray-900 text-white">
    <Header />

    <div class="flex flex-1 overflow-hidden">
      <div class="w-64 bg-gray-800 border-r border-gray-700 flex flex-col p-4 overflow-y-auto">
        <h2 class="text-xl font-semibold mb-4">Conversations</h2>

        <button @click="chatStore.startNewConversation()"
          class="mb-4 p-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium flex items-center justify-center space-x-2 transition-colors duration-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
          </svg>
          <span>New Chat</span>
        </button>

        <ul class="space-y-2 flex-1">
          <li v-for="conv in chatStore.conversations" :key="conv.id">
            <div @click="chatStore.setActiveConversation(conv.id, conv.title)"
              class="flex justify-between items-center p-2 rounded-lg cursor-pointer transition-colors duration-200"
              :class="{ 'bg-blue-700': chatStore.currentConversationId === conv.id, 'hover:bg-gray-700': chatStore.currentConversationId !== conv.id }">
              <span class="truncate pr-2">{{ conv.title || 'Untitled Chat' }}</span>
              <button @click.stop="chatStore.deleteConversation(conv.id)"
                class="text-gray-400 hover:text-red-400 p-1 rounded-full transition-colors duration-200">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm6 0a1 1 0 11-2 0v6a1 1 0 112 0V8z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </li>
        </ul>
      </div>

      <div class="flex-1 flex flex-col">
        <div class="p-4 bg-gray-800 border-b border-gray-700 text-center">
          <h2 class="text-xl font-semibold">{{ chatStore.currentConversationTitle || 'New Chat' }}</h2>
        </div>

        <div id="chat-container" class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
          <div v-for="(msg, index) in chatStore.messages" :key="index" class="flex items-start mb-4"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'">

            <div class="rounded-lg shadow-md px-4 py-3 max-w-xs md:max-w-md break-words"
              :class="msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-white'">
              <div v-html="msg.formattedContent || msg.content" class="message-content"></div>
              <div class="text-xs text-gray-400 mt-2">{{ msg.timestamp }}</div>
            </div>
          </div>

          <div v-if="chatStore.isLoading" class="flex items-center justify-center p-4">
            <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>

        <div class="p-4 bg-gray-800 border-t border-gray-700 flex items-center space-x-3">
          <div class="flex-1 relative">
            <textarea v-model="chatStore.inputMessage"
              @keydown.enter.exact.prevent="chatStore.sendMessage(chatStore.inputMessage)" rows="1"
              placeholder="Type your message..."
              class="w-full p-3 pr-12 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style="min-height: 44px; max-height: 120px; overflow-y: auto;"></textarea>
            <button @click="chatStore.sendMessage(chatStore.inputMessage)"
              class="absolute right-2 bottom-2 p-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style>
.message-content code {
  font-family: monospace;
  background-color: rgba(30, 41, 59, 0.8);
  padding: 0 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.message-content pre {
  background-color: rgba(30, 41, 59, 0.5);
  border-radius: 0.375rem;
  padding: 0.75rem;
  margin: 0.5rem 0;
  overflow-x: auto;
}

.message-content ul {
  padding-left: 1.25rem;
  margin: 0.5rem 0;
  list-style-type: disc;
}

.message-content ol {
  padding-left: 1.25rem;
  margin: 0.5rem 0;
  list-style-type: decimal;
}

.message-content h1 {
  font-size: 1.25rem;
  font-weight: bold;
  margin: 0.75rem 0;
}

.message-content h2 {
  font-size: 1.125rem;
  font-weight: bold;
  margin: 0.5rem 0;
}

.message-content h3 {
  font-size: 1rem;
  font-weight: bold;
  margin: 0.5rem 0;
}

.message-content a {
  color: #60a5fa;
  text-decoration: none;
}

.message-content a:hover {
  text-decoration: underline;
}

.message-content blockquote {
  border-left: 4px solid #6b7280;
  padding-left: 0.75rem;
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
  margin: 0.5rem 0;
  font-style: italic;
  background-color: rgba(30, 41, 59, 0.3);
}
</style>