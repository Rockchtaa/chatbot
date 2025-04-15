import { defineStore } from 'pinia';

export const useUserStore = defineStore('user', {
  state: () => ({
    userId: null,        // <- value assigned!
    username: '',        // <- value assigned!
  }),
  actions: {
    setUser(data) {
      this.userId = data.userId;
      this.username = data.username;
    },
    logout() {
      this.userId = null;
      this.username = null;
    },
  },
  persist: true,
});
