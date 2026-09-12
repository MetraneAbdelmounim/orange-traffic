# Orange Traffic — Supervision ATC-1500

Supervision web multi-contrôleurs pour les contrôleurs de trafic Oriux
ATC-1500, via SNMP/NTCIP 1202. Chaque contrôleur est rattaché à un projet ;
le badge "feu tricolore" décode toujours les alarmes en texte lisible —
jamais un entier brut — et passe au rouge dès qu'une valeur est différente
de zéro.

## Architecture

```
Angular 19 (SPA) ──► Node/Express :5000 ──► MongoDB
                           ▲                  (projects, controllers,
                           │ reads only        readings, alarmEvents,
                           │                    members)
                    Python poller :8000 ──SNMP──► contrôleurs ATC-1500
                    (pysnmp v1arch, asyncio)
```

Le service Python fait toute la lecture SNMP sur un intervalle fixe
(`POLL_INTERVAL_SECONDS`, 60s par défaut) et écrit dans MongoDB. Node ne lit
jamais un contrôleur directement — sauf pour relayer le bouton "Rafraîchir
maintenant" vers le poller.

**Important, validé empiriquement sur un vrai ATC-1500** : ce modèle ne
répond qu'en **SNMPv1** — SNMPv2c échoue systématiquement en timeout. Voir
`backend/python/snmp_client.py`.

## Démarrage local

### 1. MongoDB
```bash
docker run -d --name orange-traffic-mongo -p 27017:27017 mongo:7
```

### 2. API Node
```bash
cd backend
cp .env.example .env   # générer un JWT_SECRET avec la commande indiquée dedans
npm install
npm run dev

# Créer le premier compte admin :
node tools/seed-admin.js admin "un-mot-de-passe-solide"
```

### 3. Poller Python (SNMP)
```bash
cd backend/python
python -m venv venv && venv\Scripts\activate   # ou source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app:app --port 8000 --reload
```

### 4. Frontend Angular
```bash
cd front-end
npm install
npm start   # sert sur :4200, proxy /api vers :5000 (proxy.conf.json)
```

`npm run build` dans `front-end/` écrit dans `backend/public/`, que l'API
sert en production (un seul port, 5000).

## Docker (production)

```bash
cd backend
cp .env.example .env
docker compose up --build
```

Démarre `mongo`, `app` (API + UI), `poller` (SNMP) et `proxy` (nginx, TLS
auto-signé généré au build — accepter l'avertissement de certificat au
premier accès). Créer le compte admin une fois les conteneurs démarrés :
```bash
docker compose exec app node tools/seed-admin.js admin "un-mot-de-passe-solide"
```

Le proxy publie `8080` (HTTP → redirige vers HTTPS) et `8443` (HTTPS) plutôt
que `80`/`443`, pour cohabiter sur un serveur où ces ports sont déjà pris par
une autre application — changez-les dans `backend/docker-compose.yml` si ce
n'est pas votre cas. Pour un déploiement aux côtés de project-youness sur le
même VPS (vérification des ports, pare-feu, etc.), voir
[DEPLOYMENT.md](DEPLOYMENT.md).

## Modèle de données

- **`projects`** — un projet regroupe des contrôleurs (comme un site/une ville).
- **`controllers`** — un ATC-1500 (`ip`, `port`, `community`), avec
  `lastSnapshot` (dernier statut décodé) et `status`/`lastSeenAt`.
- **`readings`** — collection time-series, un point par sweep, pour
  l'historique du graphe (TTL `READING_RETENTION_DAYS`, 90j par défaut).
- **`alarmevents`** — une entrée par transition d'alarme (apparue/disparue),
  calculée par le poller en comparant deux sweeps — c'est le journal d'alarme,
  puisque la disponibilité d'un event-log NTCIP natif n'a jamais été
  confirmée sur ce modèle.

## Portée des objets NTCIP

| Groupe | Confiance | OID |
|---|---|---|
| `sysDescr` / `sysUpTime` | Confirmé | MIB-II standard |
| `unitAlarmStatus1` | Confirmé (table de bits fournie par le client) | `1.3.6.1.4.1.1206.4.2.1.3.8` |
| `unitAlarmStatus2` | OID confirmé, table de bits **non officielle** | `1.3.6.1.4.1.1206.4.2.1.3.7` |
| `shortAlarmStatus` | Confirmé | `1.3.6.1.4.1.1206.4.2.1.3.9` |
| Phases / détecteurs | **Non confirmé** sur ce firmware — lu en best-effort | voir `backend/python/ntcip.py` |

Si vous obtenez le fichier MIB officiel Oriux, mettez à jour
`backend/python/ntcip.py` et `decode.py` en conséquence.

## Scripts de diagnostic autonomes

`atc1500_snmp_test.py` et `atc1500_alarm_status.py` à la racine du projet
restent utiles pour tester un contrôleur en ligne de commande sans passer par
toute la plateforme (`python atc1500_snmp_test.py <ip>`).
