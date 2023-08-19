import { createApp } from 'vue'
import VueMeta from 'vue-meta';

Vue.use(VueMeta, {
    refreshOnceOnNavigation: true
});
import App from './App.vue'

createApp(App).mount('#app')