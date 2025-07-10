<script setup>
import { ref } from 'vue';
import axios from 'axios';
import { useUserStore } from '../stores/user';
import { useRouter } from 'vue-router';
import robotImage from '../assets/robot.png';

const router = useRouter();
const userStore = useUserStore();

const username = ref('');
const email = ref('');
const password = ref('');
const isRegistering = ref(true);
const loading = ref(false);
const error = ref('');

// Automatically redirect if already logged in
if (userStore.isAuthenticated()) {
  router.push('/chat');
}

const authenticateUser = async () => {
  error.value = '';

  if (!email.value || !password.value || (isRegistering.value && !username.value)) {
    error.value = 'Please fill in all required fields.';
    return;
  }

  loading.value = true;
  try {
    let endpoint = isRegistering.value ? '/register' : '/login';
    let payload = isRegistering.value
      ? { username: username.value, email: email.value, password: password.value }
      : { email: email.value, password: password.value };

    const { data } = await axios.post(`${import.meta.env.VITE_API_URL}${endpoint}`, payload);

    userStore.setUser({
      userId: data.userId,
      username: data.username,
      token: data.token, // Save the received token
    });

    router.push('/chat');
  } catch (err) {
    console.error(`Error ${isRegistering.value ? 'registering' : 'logging in'} user:`, err);
    if (axios.isAxiosError(err) && err.response) {
      error.value = err.response.data.error || 'An unexpected error occurred.';
    } else {
      error.value = 'Failed to connect to the server. Please try again later.';
    }
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="h-screen flex items-center justify-center bg-gray-900 text-white">
    <div class="p-8 bg-gray-800 rounded-lg shadow-lg w-full max-w-md">
      <img :src="robotImage" alt="Chat AI Robot" class="mx-auto w-24 h-24 mb-4" />
      <h1 class="text-2xl font-semibold mb-6 text-center">
        Welcome To Chat AI
      </h1>

      <div class="mb-4 text-center">
        <button @click="isRegistering = true"
          :class="{ 'bg-blue-600': isRegistering, 'bg-gray-700': !isRegistering }"
          class="px-4 py-2 rounded-l-lg transition-colors duration-200">Register</button>
        <button @click="isRegistering = false"
          :class="{ 'bg-blue-600': !isRegistering, 'bg-gray-700': isRegistering }"
          class="px-4 py-2 rounded-r-lg transition-colors duration-200">Login</button>
      </div>

      <input type="email" class="w-full p-3 mb-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Email"
        v-model="email" />
      <input type="password" class="w-full p-3 mb-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Password"
        v-model="password" />
      <input v-if="isRegistering" type="text"
        class="w-full p-3 mb-3 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Username" v-model="username" />


      <button @click="authenticateUser" class="w-full p-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-lg font-semibold transition-colors duration-200"
        :disabled="loading">
        {{ loading ? (isRegistering ? 'Registering...' : 'Logging in...') : (isRegistering ? 'Register' : 'Login') }}
      </button>

      <p v-if="error" class="text-red-400 text-center mt-4 text-sm">{{ error }}</p>
    </div>
  </div>
</template>