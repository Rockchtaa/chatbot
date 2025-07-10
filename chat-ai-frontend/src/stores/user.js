import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUserStore = defineStore('user', {
  state: () => ({
    userId: ref(null),
    username: ref(''),
    token: ref(null), // Store the JWT
  }),
  actions: {
    setUser(data) {
      this.userId = data.userId;
      this.username = data.username;
      this.token = data.token; // Save the token
    },
    logout() {
      this.userId = null;
      this.username = null;
      this.token = null; // Clear the token on logout
    },
    // Action to check if user is authenticated (has a token)
    isAuthenticated() {
      return !!this.token && !!this.userId;
    }
  },
  persist: true, // Keep state in local storage
});