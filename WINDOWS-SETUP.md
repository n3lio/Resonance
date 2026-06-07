# 🪟 Windows Setup Guide (PC Fixe)

**Pour Lionel — Guide rapide pour ton PC fixe Windows 11**

---

## 🎯 Première installation (une seule fois)

### 1️⃣ Installer Node.js

- Va sur https://nodejs.org/
- Télécharge la version **LTS** (Long Term Support)
- Lance l'installeur, clique sur "Next" partout
- ✅ Vérifie : ouvre **CMD** et tape `node --version` → devrait afficher `v20.x.x`

### 2️⃣ Installer mpv (pour le mode PC)

**Option A — Chocolatey (si tu l'as déjà)** :
```bash
choco install mpv
```

**Option B — Manuel** :
1. Va sur https://mpv.io/installation/
2. Télécharge le **Windows builds** (shinchiro recommended)
3. Extrais le zip quelque part (ex: `C:\Program Files\mpv\`)
4. Ajoute au PATH :
   - Recherche Windows → "Variables d'environnement"
   - Clique sur "Variables d'environnement..."
   - Dans "Variables système", double-clic sur **Path**
   - Ajoute le chemin vers le dossier mpv (ex: `C:\Program Files\mpv`)
   - OK partout
5. ✅ Vérifie : ouvre **CMD** et tape `mpv --version`

### 3️⃣ Récupérer le projet

**Si Git est installé** :
```bash
cd C:\Users\Lionel\Music
git clone https://github.com/n3lio/radio-mp3.git Resonance
cd Resonance
```

**Sinon** (transfert manuel) :
1. Copie le dossier `Resonance` depuis ton Mac via USB/réseau/cloud
2. Mets-le dans `C:\Users\Lionel\Music\Resonance\`

### 4️⃣ Configurer le chemin de ta musique

1. Ouvre `config.json` avec Notepad++/VSCode/Notepad
2. Change le path :
   ```json
   {
     "musicFolders": ["C:/Users/Lionel/Music"],
     ...
   }
   ```
   ⚠️ **Important** : utilise `/` ou `\\`, pas juste `\`

### 5️⃣ Créer le raccourci bureau

1. Clique-droit sur `create-desktop-shortcut.ps1`
2. "Run with PowerShell"
3. Un raccourci "Resonance" apparaît sur ton bureau

---

## 🚀 Lancer Resonance

**Double-clic sur l'icône "Resonance" sur le bureau** — c'est tout !

Une fenêtre CMD s'ouvre, le serveur démarre, et tu vois :

```
╔══════════════════════════════════════════════════╗
║           🎵  RESONANCE — SERVER UP  🎵          ║
╠══════════════════════════════════════════════════╣
║  Started:  07/06/2026 21:30:45                   ║
║  Local:    http://localhost:3000                 ║
║  LAN:      http://192.168.1.42:3000              ║
║  Security: Helmet + rate limiting ✔              ║
╚══════════════════════════════════════════════════╝
```

Ouvre ton navigateur → **http://localhost:3000**

---

## 📱 Accéder depuis ton téléphone/laptop

1. Note l'IP affichée dans la fenêtre CMD (ex: `192.168.1.42`)
2. Sur ton téléphone (même WiFi), ouvre le navigateur
3. Va sur **http://192.168.1.42:3000**
4. 🎉 Tu peux contrôler la musique depuis n'importe quel device

---

## 🔄 Mettre à jour (quand y'a des nouveautés)

Si t'as installé via Git :

```bash
cd C:\Users\Lionel\Music\Resonance
git pull origin main
```

Puis relance le serveur (ferme la fenêtre CMD et double-clic sur "Resonance").

---

## 🐛 Problèmes courants

### ❌ "Port 3000 already in use"

Quelque chose utilise déjà le port. Change-le dans `config.json` :
```json
"port": 3001
```

### ❌ "mpv not found"

mpv n'est pas dans le PATH. Vérifie avec `where mpv` dans CMD.

### ❌ Pas de musiques trouvées

Le path dans `config.json` est incorrect. Vérifie avec :
```bash
dir C:\Users\Lionel\Music
```

### ❌ Impossible d'accéder depuis un autre device

Le firewall Windows bloque. Va dans :
- Paramètres Windows → "Pare-feu et protection réseau"
- "Autoriser une application via le pare-feu"
- Cherche **Node.js** et coche les cases "Privé" et "Public"

---

## 💡 Astuces

- **Arrêter le serveur** : Ferme la fenêtre CMD (ou Ctrl+C)
- **Voir les logs** : Tout s'affiche dans la fenêtre CMD
- **Playlists** : Sauvegardées automatiquement dans `playlists.json`
- **Covers** : Si tes MP3 ont des covers embedded, elles s'affichent automatiquement
- **Recherche** : Tape dans la barre en haut → filtre en temps réel
- **Shuffle** : Clique sur le bouton 🔀 en haut ou dans la queue

---

## 🌐 Accès distant (bonus)

Si tu veux accéder à ta musique depuis l'extérieur (pas chez toi) :

1. Installe **cloudflared** : https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. Lance Resonance normalement
3. Dans un autre CMD :
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
4. Copie l'URL temporaire (genre `https://abc123.trycloudflare.com`)
5. Ouvre-la depuis n'importe où

⚠️ L'URL change à chaque fois. Pour une URL permanente, faut setup un tunnel Cloudflare (plus complexe).

---

**Enjoy ! 🎵**
