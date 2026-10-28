# Développement et compatibilité

## Travail local

```sh
bun install --frozen-lockfile
bun test
bun run typecheck
bun run build
bun run preview
```

Les tests utilisent des identifiants synthétiques, des bases temporaires et des
réponses HTTP simulées. L’aperçu isolé n’accède ni aux comptes OpenCode ni à ChatGPT.
Vérifiez Compact/Tickets/Mini, les réglages, les vues étroites, les deux langues,
le focus clavier, la confirmation et les résultats incertains. Les captures
publiques doivent utiliser des données fictives.

Installez le dossier compilé dans **Paramètres → Extensions**. Recompilez et rechargez
après modification ; désactivez puis réactivez après un changement du service.
Les utilisateurs installent les entrées compilées `panel/` et `service/`, pas le TypeScript.

```sh
bun run package /absolute/path/to/new/openchamber-codex-reset-credits-0.1.0
bun run docs:dev
bun run docs:build
```

La documentation utilise VitePress 1.6.4, deux langues, la recherche locale et la
base `/openchamber-codex-reset-credits/`. Gardez les traductions cohérentes avec le comportement.
Le packaging crée un nouveau dossier installable, une archive `.tar.gz` et un fichier
`.sha256` ; les chemins de sortie ne doivent pas déjà exister.

## Limites à préserver

- Manifeste : OpenChamber **>=2.5.0**, API **1**, dépendance de développement SDK **2.5.3**.
- Un panneau de rail, une section Work Status, un service hôte autorisé à exécuter `sqlite3`.
- Lecture seule du schéma de connexion local par défaut d’OpenCode 2 uniquement.
- Endpoints ChatGPT internes et fixes ; les jetons d’accès ne quittent le service
  que pour les requêtes authentifiées à ChatGPT. Pas de gestion des jetons de
  renouvellement ni de changement de compte.
- Consommation irréversible avec confirmation explicite, revalidation et protection
  contre les doublons. Un résultat inconnu ne doit jamais devenir un échec à réessayer.

La version minimale du manifeste ne signifie pas que toutes les combinaisons hôte/version
ont été testées. OpenCode distant, chemins personnalisés, V1 `auth.json`, hébergement
VS Code et mobile sont hors périmètre. Aucune consommation réelle n’a été vérifiée.

Proposez directement une pull request pour une petite correction ; discutez d’abord
les changements importants dans une issue. Voir [Contribuer sur GitHub](https://github.com/sofianbll/openchamber-codex-reset-credits/blob/main/CONTRIBUTING.md).
N’ajoutez jamais d’identifiants ni de données privées aux fixtures, journaux ou captures.
