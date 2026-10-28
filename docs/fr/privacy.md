# Confidentialité et sécurité

## Ce qui est lu

Le service hôte exécute `sqlite3 -readonly` sur
`~/.local/share/opencode/opencode.db`. Il sélectionne uniquement les entrées OAuth
OpenAI : identifiant de connexion, libellé, état actif, jeton d’accès et identifiant
de compte ChatGPT. Il ne sélectionne **ni** l’objet de connexion complet, **ni** les
jetons de renouvellement, clés API ou identifiants MCP.

Le service utilise les droits de votre utilisateur, **sans sandbox système**. Son
serveur HTTP local écoute sur `127.0.0.1` et exige le jeton de service OpenChamber,
y compris pour le contrôle de santé. Les préférences d’affichage utilisent le
stockage d’extension de l’hôte.

## Ce qui est envoyé

- **GET** `https://chatgpt.com/backend-api/wham/rate-limit-reset-credits` lit les crédits.
- **POST** sur cette URL suivie de `/consume` demande une consommation, après confirmation.
- Les deux utilisent le jeton d’accès et l’en-tête `ChatGPT-Account-Id`. La
  consommation envoie `credit_id` et un UUID généré dans `redeem_request_id`.

L’origine HTTPS est fixe et les redirections refusées. Les jetons restent dans le
service ; le panneau reçoit les libellés/identifiants de comptes, métadonnées des
crédits et codes d’erreur fixes. Les corps d’erreur distants et diagnostics de
sous-processus ne sont ni transmis ni journalisés.

## Ce qui n’arrive jamais

Aucune écriture en base, sélection de compte, connexion automatique, actualisation
de jeton, consommation automatique ou nouvelle tentative automatique. L’extension
ne modifie pas Paramètres → Fournisseurs et ne remplace pas l’affichage d’usage
d’OpenChamber. Lire un compte inactif ne l’active pas. Les tests et l’aperçu
synthétique ne consomment aucun crédit réel.

## Un résultat incertain n’est pas un échec

La consommation est irréversible. Avant l’envoi, le service relit le crédit choisi.
Les doublons sont bloqués entre surfaces et connexions au même compte ChatGPT.
Une réponse reconnue est affichée avec le code résultat de Codex ; un HTTP 200
seul n’est pas considéré comme une réussite.

Si la réponse est perdue ou non reconnue après l’envoi, le résultat est **inconnu**.
Le service bloque une autre tentative sur ce crédit pour le reste de sa durée de
vie. **Ne réessayez pas.** Actualisez pour rapprocher les statuts et vérifiez l’usage
sur ChatGPT avant toute autre action.

Ces verrous sont **uniquement en mémoire**. Redémarrer, suspendre ou désinstaller
efface les verrous du service, pas l’action distante. Cela ne prouve jamais son échec.

## Limites de compatibilité

Les endpoints ChatGPT sont internes et peuvent changer. Seule la base locale par
défaut et le schéma observé d’OpenCode 2 sont pris en charge : pas de serveur distant,
chemin personnalisé, V1 `auth.json`, hébergement VS Code ou mobile. Certaines connexions
doivent être renouvelées dans OpenCode. Aucune consommation réelle n’a été vérifiée.
Cette extension communautaire n’est pas affiliée à OpenAI.
