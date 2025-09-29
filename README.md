# Sport Calendar

Une application web moderne pour planifier, suivre et analyser tes séances de sport. L'interface propose une palette de sports avec drag-and-drop sur un calendrier hebdomadaire, une modale de détail riche et un coach IA intégré (Mistral) pour générer des idées d'entraînement.

## Fonctionnalités

- Authentification Firebase (création de compte, connexion, réinitialisation de mot de passe).
- Vue calendrier par semaine (choix du premier jour, navigation par semaine, sélection rapide d'un mois).
- Palette de sports drag-and-drop (judo, jjb, musculation, yoga, stretching, cardio).
- Modale de saisie avec variations par sport, tags d'intensité et de sensations, planification ou reporting.
- Sauvegarde et synchronisation temps réel des séances via Firestore.
- Coach IA accessible depuis la palette ou la modale pour générer du contenu personnalisé grâce à l'API Mistral.

## Prérequis

- Navigateur moderne (Chrome, Edge, Firefox, Safari).
- Configuration Firebase active (les clés de configuration sont déjà définies dans `app.js`).
- Accès réseau sortant pour contacter Firebase et l'API Mistral.

## Lancer le projet

1. Clone le dépôt puis ouvre le dossier :

   ```bash
   git clone <repo>
   cd sport-calendar
   ```

2. Sers les fichiers statiques avec ton serveur favori (exemples) :

   ```bash
   # Python 3
   python -m http.server 5173

   # ou avec Node.js (serve)
   npx serve .
   ```

3. Ouvre [http://localhost:5173](http://localhost:5173) dans ton navigateur.

4. Crée un compte ou connecte-toi pour accéder au calendrier.

## Personnalisation

- Les sports et leurs variations sont définis au début de `app.js` (`const sports = [...]`).
- Les tags d'intensité et de sensation peuvent être ajustés dans `app.js` (`intensityOptions`, `feelingOptions`).
- Le style général est géré dans `styles.css`. Les couleurs principales sont définies en variables CSS en tête du fichier.

## Sécurité

Les clés Firebase et la clé API Mistral sont utilisées côté client selon la configuration fournie. Pour un déploiement en production, envisage une couche backend ou des règles de sécurité strictes dans Firebase pour protéger tes données.

## Licence

Projet réalisé à des fins démonstratives. Ajuste la licence selon tes besoins.
