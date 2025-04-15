<script setup>
import { ref } from 'vue';
import axios from 'axios';
import { useUserStore } from '../stores/user';
import { useRouter } from 'vue-router';
import robotImage from '../assets/robot.png';
const router = useRouter();
const userStore = useUserStore();


const name = ref('');
const email = ref('');
const loading = ref(false);
const error = ref('');

const createUser = async () => {
  if (!name.value || !email.value) {
    error.value = 'Name and email are required';
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/register-user`, {
      username: name.value,
      email: email.value,
    });

    userStore.setUser({
      userId: data.userId,
      username: data.username,
    });

    router.push('/chat');
  } catch (error) {

    console.error('Error creating user:', error);
    error.value = 'Failed to create user. Please try again.';

  } finally {
    loading.value = false;
  }



};
</script>

<template>
  <div class="h-screen flex items-center justify-center bg-gray-900 text-white">
    <div class="p-8 bg-gray-800 rounded-lg shadow-lg w-full max-w-md">
      <img :src="robotImage" alt="" class="mx-auto w-24 h-24 mb-4" />
      <h1 class="text-2xl font-semibold mb-4 text-center">
        Welcome To Chat AI
      </h1>

      <input type="text" class="w-full p-2 mb-2 bg-gray-700 text-white rounded-lg focus:outline-none" placeholder="Name"
        v-model="name" />
      <input type="email" class="w-full p-2 mb-2 bg-gray-700 text-white rounded-lg focus:outline-none"
        placeholder="Email" v-model="email" />

      <button @click="createUser" class="w-full p-2 bg-blue-500 rounded-lg" :disabled="loading">
        {{ loading ? 'Logging in...' : 'Start Chat' }}
      </button>

      <p v-if="error" class="text-red-400 text-center mt-2">{{ error }}</p>
    </div>
  </div>
</template>