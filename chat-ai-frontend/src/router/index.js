import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import ChatView from '../views/ChatView.vue';
import { useUserStore } from '../stores/user'; // Import your user store

const routes = [
  { path: '/', name: 'Home', component: HomeView }, // Renamed for clarity
  { path: '/chat', name: 'Chat', component: ChatView, meta: { requiresAuth: true } }, // Add meta field
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Navigation Guard
router.beforeEach((to, from, next) => {
  const userStore = useUserStore(); // Get the store instance

  if (to.meta.requiresAuth && !userStore.isAuthenticated()) {
    // If the route requires authentication and the user is not authenticated,
    // redirect to the home (login/register) page.
    next({ name: 'Home' });
  } else if (!to.meta.requiresAuth && userStore.isAuthenticated()) {
    // If the user is already authenticated and tries to go to a non-protected route (like Home),
    // redirect them to the chat page.
    next({ name: 'Chat' });
  }
  else {
    // Otherwise, allow navigation
    next();
  }
});