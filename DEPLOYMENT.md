# Déploiement — VPS partagé avec project-youness

Ce guide déploie Orange Traffic **aux côtés** de project-youness sur le même
VPS Windows, sans toucher à sa configuration. Les deux apps tournent dans des
projets Docker Compose séparés, chacun avec son propre réseau interne — seuls
les ports **publiés sur l'hôte** peuvent entrer en conflit.

## Pourquoi des ports différents

project-youness publie déjà `80` et `443` (son service `proxy`). Orange
Traffic utilise donc **`8080`/`8443`** à la place — voir
`backend/docker-compose.yml`. Rien d'autre ne se recoupe : Mongo, l'API Node
et le poller Python de chaque app restent internes à leur propre réseau
Docker (jamais publiés sur l'hôte), donc réutiliser les mêmes ports internes
(5000, 8000, 27017) d'une app à l'autre est sans risque.

Toutes les commandes ci-dessous sont **PowerShell**, à lancer en **élevé**
directement sur le VPS.

---

## 1. Vérifier que les ports sont bien libres

```powershell
# 80/443 doivent appartenir à project-youness (normal, ne pas y toucher) :
Get-NetTCPConnection -LocalPort 80,443 -State Listen -ErrorAction SilentlyContinue

# 8080/8443 doivent être libres avant de démarrer Orange Traffic :
Get-NetTCPConnection -LocalPort 8080,8443 -State Listen -ErrorAction SilentlyContinue
```

Si `8080`/`8443` affichent déjà un résultat, changez les deux valeurs dans
`backend\docker-compose.yml` (section `proxy: ports:`) avant de continuer.

```powershell
docker version --format '{{.Server.Os}}'   # doit afficher : linux
```

---

## 2. Récupérer le code sur le VPS

```powershell
cd C:\path\to\
git clone <url-du-repo> orange-traffic
cd orange-traffic
```

(ou `git pull` si le dossier existe déjà.)

---

## 3. Créer `backend\.env`

```powershell
cd backend
Copy-Item .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT_SECRET
notepad .env
```

Minimum pour la prod :

```ini
NODE_ENV=production
JWT_SECRET=<le secret généré ci-dessus>
JWT_EXPIRATION=12h
MONGO_URL=mongodb://mongo:27017/orangetraffic
HOST_PY=poller
PORT_PY=8000
CORS_ORIGINS=
POLL_INTERVAL_SECONDS=60
READING_RETENTION_DAYS=90
DEFAULT_SNMP_COMMUNITY=public
```

Restreignez le fichier aux administrateurs :

```powershell
icacls .env /inheritance:r /grant:r "Administrators:(R,W)" "SYSTEM:(R,W)"
```

---

## 4. Construire et démarrer

```powershell
cd C:\path\to\orange-traffic\backend
docker compose build
docker compose up -d
docker compose ps
```

Le service `proxy` génère automatiquement un **certificat auto-signé** au
build (voir `backend/nginx/Dockerfile`) — aucune étape manuelle requise. Les
navigateurs afficheront un avertissement de certificat au premier accès
(normal, pas d'autorité de certification tierce) : c'est le même
fonctionnement que project-youness sur ce VPS.

---

## 5. Créer le compte admin

```powershell
docker compose exec app node tools/seed-admin.js admin "un-mot-de-passe-solide"
```

---

## 6. Ouvrir le pare-feu pour 8080/8443

```powershell
New-NetFirewallRule -DisplayName "Orange Traffic HTTP" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow
New-NetFirewallRule -DisplayName "Orange Traffic HTTPS" -Direction Inbound -Protocol TCP -LocalPort 8443 -Action Allow
```

---

## 7. Vérifier

```powershell
curl.exe -sk https://VPS_IP:8443/api/health        # {"status":"ok","db":"connected"}
docker compose logs --tail=30 poller               # "Sweep finished in Xs (N controllers)"
docker exec orange-traffic-poller ping -c 2 10.8.3.20   # le poller doit joindre le réseau des contrôleurs
```

Dans le navigateur, `https://VPS_IP:8443/` (accepter l'avertissement de
certificat) :

- [ ] connexion avec le compte admin créé à l'étape 5
- [ ] création d'un projet + d'un contrôleur
- [ ] le badge feu tricolore affiche le bon statut après un sweep
- [ ] `project-youness` (sur `https://VPS_IP/`) répond toujours normalement

Confirmez que `project-youness` n'a subi aucune interruption — ses
conteneurs ne sont ni arrêtés ni reconstruits par cette procédure, mais un
`docker compose down` lancé par erreur dans le **mauvais** dossier
arrêterait la mauvaise application. Vérifiez toujours `pwd` avant tout
`docker compose down`.

---

## Après

**Démarrage automatique au redémarrage.** `restart: always` gère les
conteneurs, à condition que Docker démarre lui-même automatiquement
(généralement déjà configuré si project-youness tourne déjà) :

```powershell
Get-Service com.docker.service | Select-Object Name, StartType, Status
```

**Sauvegarde nocturne de Mongo** — même principe que pour project-youness,
sur sa propre base :

```powershell
docker exec orange-traffic-mongo mongodump --db orangetraffic --archive=/tmp/nightly.archive --gzip
docker cp orange-traffic-mongo:/tmp/nightly.archive "C:\backups\orangetraffic-$(Get-Date -Format yyyy-MM-dd).archive"
```

**Réglages du poller** dans `.env` (redémarrer `poller` après modification) :

| Variable | Défaut | Rôle |
|---|---|---|
| `POLL_INTERVAL_SECONDS` | `60` | secondes entre deux sweeps |
| `POLL_CONCURRENCY` | `16` | contrôleurs lus en parallèle |
| `READING_RETENTION_DAYS` | `90` | historique conservé avant expiration |
