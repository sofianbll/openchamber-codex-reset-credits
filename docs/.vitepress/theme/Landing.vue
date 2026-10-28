<script setup>
import { computed } from 'vue';
import { useData, withBase } from 'vitepress';

const { lang } = useData();
const french = computed(() => lang.value === 'fr');
const link = (page) => withBase(`${french.value ? '/fr' : ''}/${page}.html`);
const text = computed(() => french.value ? {
  title: 'Vos resets Codex, au même endroit.',
  intro: 'Consultez les crédits des comptes ChatGPT déjà connectés dans OpenCode. Gardez-les à portée de main dans OpenChamber, sans changer de compte.',
  install: 'Installer l’extension', usage: 'Lire le guide',
  alt: 'Panneau Codex resets en vue Compact avec des comptes et crédits fictifs',
  sidebarAlt: 'Section Work Status en vue Mini avec des comptes fictifs et les icônes d’action',
  caption: 'Un panneau complet et une section Work Status. Données fictives dans un aperçu isolé.',
  points: [
    ['La bonne vue', 'Compact, Tickets ou Mini. Réglez le panneau et la sidebar séparément.', 'usage'],
    ['Votre confirmation', 'Un crédit, un compte, une confirmation. Rien n’est consommé automatiquement.', 'usage'],
    ['Des limites claires', 'Les jetons restent dans le service. Un résultat incertain bloque une nouvelle tentative.', 'privacy'],
  ],
  requirement: 'OpenChamber 2.5.0+, OpenCode 2 avec comptes ChatGPT OAuth et sqlite3 sur l’hôte.',
  note: 'Extension communautaire indépendante. API ChatGPT interne, susceptible de changer.',
} : {
  title: 'Your Codex resets, together.',
  intro: 'See the credits of the ChatGPT accounts already connected in OpenCode. Keep them close in OpenChamber, without switching accounts.',
  install: 'Install the extension', usage: 'Read the guide',
  alt: 'Codex resets panel in Compact view with fictional accounts and credits',
  sidebarAlt: 'Work Status section in Mini view with fictional accounts and compact action icons',
  caption: 'A full panel and a Work Status section. Fictional data in an isolated preview.',
  points: [
    ['The right view', 'Compact, Tickets or Mini. Set the panel and sidebar views separately.', 'usage'],
    ['Your confirmation', 'One credit, one account, one confirmation. Nothing is consumed automatically.', 'usage'],
    ['Clear boundaries', 'Tokens stay in the service. An uncertain result blocks another attempt.', 'privacy'],
  ],
  requirement: 'OpenChamber 2.5.0+, OpenCode 2 with ChatGPT OAuth accounts, and sqlite3 on the host.',
  note: 'Independent community extension. Uses an internal ChatGPT API that may change.',
});
</script>

<template>
  <main class="resets-home">
    <section class="resets-hero">
      <h1>{{ text.title }}</h1>
      <div>
        <p>{{ text.intro }}</p>
        <div class="resets-actions">
          <a class="resets-button" :href="link('installation')">{{ text.install }}</a>
          <a class="resets-link" :href="link('usage')">{{ text.usage }}</a>
        </div>
      </div>
    </section>
    <figure class="resets-screenshot">
      <div class="resets-shots">
        <img :src="withBase('/screenshots/panel-compact.png')" :alt="text.alt" width="402" height="425" fetchpriority="high">
        <img :src="withBase('/screenshots/sidebar-mini.png')" :alt="text.sidebarAlt" width="304" height="238">
      </div>
      <figcaption>{{ text.caption }}</figcaption>
    </figure>
    <section class="resets-points" :aria-label="french ? 'L’essentiel' : 'At a glance'">
      <div v-for="point in text.points" :key="point[0]">
        <h2><a :href="link(point[2])">{{ point[0] }}</a></h2>
        <p>{{ point[1] }}</p>
      </div>
    </section>
    <aside class="resets-requirements"><p>{{ text.requirement }}</p><small>{{ text.note }}</small></aside>
  </main>
</template>
