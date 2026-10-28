import { defineConfig } from 'vitepress';

const repo = 'https://github.com/sofianbll/openchamber-codex-reset-credits';
const sidebar = (fr = false) => [
  { text: fr ? 'Premiers pas' : 'Start here', items: [
    { text: fr ? 'Installer et mettre à jour' : 'Install & update', link: `${fr ? '/fr' : ''}/installation` },
    { text: fr ? 'Utilisation' : 'Usage', link: `${fr ? '/fr' : ''}/usage` },
  ] },
  { text: fr ? 'À savoir' : 'Good to know', items: [
    { text: fr ? 'Confidentialité et sécurité' : 'Privacy & safety', link: `${fr ? '/fr' : ''}/privacy` },
    { text: fr ? 'Résoudre un problème' : 'Troubleshooting', link: `${fr ? '/fr' : ''}/troubleshooting` },
    { text: fr ? 'Développement et compatibilité' : 'Development & compatibility', link: `${fr ? '/fr' : ''}/development` },
  ] },
];

export default defineConfig({
  title: 'Codex resets',
  description: 'See and use Codex reset credits for the ChatGPT accounts connected in OpenCode.',
  base: '/openchamber-codex-reset-credits/',
  cleanUrls: false,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/openchamber-codex-reset-credits/icon.svg' }],
    ['meta', { name: 'theme-color', content: '#171717' }],
  ],
  locales: {
    root: { label: 'English', lang: 'en', themeConfig: {
      nav: [{ text: 'Install', link: '/installation' }, { text: 'Usage', link: '/usage' }], sidebar: sidebar(),
    } },
    fr: { label: 'Français', lang: 'fr', link: '/fr/', description: 'Consultez et utilisez les crédits de réinitialisation Codex des comptes ChatGPT connectés dans OpenCode.', themeConfig: {
      nav: [{ text: 'Installer', link: '/fr/installation' }, { text: 'Utilisation', link: '/fr/usage' }], sidebar: sidebar(true),
      docFooter: { prev: 'Précédent', next: 'Suivant' }, outline: { label: 'Sur cette page' },
      sidebarMenuLabel: 'Sommaire', returnToTopLabel: 'Haut de page', langMenuLabel: 'Changer de langue', darkModeSwitchLabel: 'Apparence',
      footer: { message: 'Extension communautaire indépendante. Licence MIT. Captures avec données fictives.' },
    } },
  },
  themeConfig: {
    logo: '/icon.svg',
    socialLinks: [{ icon: 'github', link: repo }],
    search: { provider: 'local', options: { locales: { fr: { translations: {
      button: { buttonText: 'Rechercher', buttonAriaLabel: 'Rechercher dans la documentation' },
      modal: { noResultsText: 'Aucun résultat pour', resetButtonTitle: 'Effacer', footer: { selectText: 'sélectionner', navigateText: 'parcourir', closeText: 'fermer' } },
    } } } } },
    footer: { message: 'Independent community extension. MIT licensed. Screenshots use fictional data.' },
  },
});
