# Résoudre un problème

Commencez par **Actualiser** : cela contourne le cache de lecture normal de 30 secondes.
Une erreur de compte ne signifie pas zéro crédit ; les autres comptes lisibles
peuvent toujours afficher leurs crédits.

::: danger Consommation incertaine
Pour `REDEMPTION_UNKNOWN` ou `ALREADY_REQUESTED`, **ne réessayez pas**. Actualisez et
vérifiez l’usage du compte sur ChatGPT. Ne redémarrez pas pour contourner le verrou :
les verrous en mémoire peuvent disparaître sans résoudre le résultat distant.
[Détails de sécurité](privacy.md).
:::

## Retrouver le message

| Message ou code | Que faire |
| --- | --- |
| Aucun compte ChatGPT OAuth | Connectez un compte ChatGPT dans **Paramètres → Fournisseurs**, puis actualisez. Les clés API ne comptent pas. |
| `SIGN_IN_REQUIRED`, `ACCOUNT_ID_MISSING` | Reconnectez-vous via **Paramètres → Fournisseurs** dans OpenCode/OpenChamber, puis actualisez ici. L’extension ne renouvelle pas la connexion. |
| Permission / capacité du service refusée, désactivée ou indisponible | Autorisez et activez le service hôte dans **Paramètres → Extensions**, puis actualisez. |
| `SQLITE_MISSING` | Installez `sqlite3` sur l’hôte OpenChamber et rendez-le accessible au processus hôte. |
| `DATABASE_UNAVAILABLE` | Vérifiez les comptes connectés dans la base locale par défaut d’OpenCode et son accès en lecture pour l’utilisateur hôte. Ne modifiez pas les permissions à l’aveugle. |
| `DATABASE_SCHEMA` | Le schéma ne correspond pas à celui pris en charge. Vérifiez la [compatibilité](development.md) ; signalez le code sans partager la base. |
| `RATE_LIMITED` | Patientez avant d’actualiser ; répéter les demandes n’aide pas. |
| `NOT_SUPPORTED`, `ACCESS_DENIED` | Codex n’expose pas les crédits de réinitialisation à ce compte. Actualisez plus tard ou vérifiez leur disponibilité sur ChatGPT ; ne supposez pas zéro crédit. |
| `CODEX_UNREACHABLE`, `CODEX_ERROR` | Vérifiez l’accès réseau de l’hôte à ChatGPT, puis actualisez plus tard. |
| `INVALID_RESPONSE` | L’API interne a peut-être changé. Actualisez une fois ; si cela persiste, signalez le code fixe et la version, pas les réponses brutes ou les jetons. |
| `CREDIT_UNAVAILABLE`, `ACCOUNT_NOT_FOUND` | Le crédit ou le compte a changé. Actualisez avant une autre action. |
| `INVALID_REQUEST`, `UNAUTHORIZED`, `NOT_FOUND`, `SERVICE_ERROR`, `REQUEST_FAILED` | Vérifiez la compatibilité extension/hôte et l’activation du service, puis actualisez. Si cela persiste, signalez le code fixe et les versions. |

## Un compte manque dans la sidebar

Ouvrez le panneau complet. Mini masque les comptes indisponibles par défaut, et la
limite de comptes peut en masquer d’autres. Vérifiez le résumé ambre, **+N autres**
et les réglages de la roue dentée. Ces préférences ne suppriment aucun compte et
ne les masquent pas dans le panneau complet.

## Un crédit n’a pas de date d’expiration

**Non communiqué** signifie que Codex ne fournit pas de date, pas que le crédit
n’expire jamais. Seuls les crédits disponibles, non expirés et sans tentative
précédente peuvent être confirmés.

Pour obtenir de l’aide, [ouvrez une issue](https://github.com/sofianbll/openchamber-codex-reset-credits/issues)
avec les versions, le code d’erreur fixe et les étapes. Ne joignez jamais de jetons,
base d’identifiants ou informations privées de compte.
