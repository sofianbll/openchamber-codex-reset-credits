# Utiliser les crédits de réinitialisation

Ouvrez **Codex resets** dans le rail pour le panneau complet, ou sa section dans
**Work Status** pour la sidebar. Les deux partagent les comptes, crédits et service.

## Trois vues

- **Compact** regroupe les crédits par compte, avec des comptes repliables.
- **Tickets** présente chaque crédit sous forme de ticket ; les comptes restent repliables.
- **Mini** garde les tickets des comptes visibles. Cliquez sur un ticket pour
  afficher ou masquer ses détails ; les en-têtes de compte ne se replient pas.

Le sélecteur du panneau change seulement sa vue courante. La roue dentée règle
séparément la **vue sidebar** et le **panneau par défaut**. **Voir le panneau**
applique ce défaut, pas la dernière vue temporaire. Work Status n’a pas de menu
de réglages. Les libellés suivent la langue française ou anglaise de l’hôte ; les
titres et descriptions des crédits restent tels que Codex les renvoie.

![Vue Tickets avec des crédits et détails de comptes fictifs](/screenshots/panel-tickets.png)

## Une sidebar plus discrète

La roue dentée règle aussi :

- **Comptes indisponibles** : afficher les comptes en erreur dans Mini ; désactivé par défaut.
- **Comptes affichés** : un maximum entier positif, ou vide pour tous les comptes.

![Réglages séparés de la sidebar, du panneau par défaut et du nombre de comptes](/screenshots/panel-settings.png)

La sidebar affiche d’abord le compte sélectionné et lisible, puis les autres
comptes avec des resets disponibles, les comptes lisibles sans reset et les comptes
en erreur. Un compte non sélectionné n’est pas automatiquement indisponible. Le
filtrage et le tri précèdent la limite ; **+N autres** révèle la suite. Le panneau
complet n’est pas filtré et garde son ordre de comptes.

![Sidebar Mini avec des comptes fictifs et leurs tickets compacts](/screenshots/sidebar-mini.png)

Un résumé en haut de la section totalise les crédits disponibles des comptes
lisibles, indépendamment de la limite sidebar. Un indicateur ambre signale les
comptes indisponibles masqués ; une disponibilité inconnue n’est pas zéro, et un
total partiel est expliqué au survol. OpenChamber ne permet pas aux extensions de
décorer l’en-tête d’une section repliée : le résumé n’apparaît que section ouverte.

![Résumé de la sidebar : crédits disponibles et comptes indisponibles](/screenshots/sidebar-summary.png)

## Lire, confirmer, vérifier

1. Ouvrez les détails du crédit. Vérifiez compte, statut et dates. Une date absente
   est **Non communiqué**, pas une garantie de validité illimitée.
2. Choisissez **Utiliser**, puis vérifiez la confirmation indiquant le crédit et le compte.
3. Choisissez **Annuler**, ou **Confirmer la consommation** pour le consommer définitivement.
4. Le service relit sa disponibilité avant l’envoi ; l’interface affiche ensuite
   le code résultat de Codex et actualise la liste. Un HTTP 200 ne prouve pas la réussite.

Les crédits expirés, utilisés ou au statut inconnu ne peuvent pas être consommés.
Les doublons sont bloqués entre panneau, sidebar et connexions au même compte ChatGPT.

::: warning Résultat incertain ? Ne réessayez pas.
Actualisez et vérifiez l’usage du compte sur ChatGPT. Le service bloque ce crédit
pour le reste de sa durée de vie. Les verrous sont en mémoire : redémarrer ou
suspendre les efface, sans prouver l’échec de la consommation. [Détails](privacy.md).
:::

**Actualiser** relit comptes et crédits en contournant le cache normal (30 secondes
maximum). Une erreur de connexion apparaît comme une erreur, jamais comme zéro crédit.
