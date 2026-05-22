# Handleliste

Din personlige ønskeliste-app. Lim inn lenker fra Zalando, Boozt, XXL, Power, Elkjøp og Komplett — PCen henter navn, bilde og pris automatisk.

## Live app
**https://muhammadfaizankhanjaved1-netizen.github.io/handleliste/**

---

## Slik fungerer det

1. Du limer inn en lenke på telefonen (eller PC) og trykker "Legg til"
2. Varen lagres umiddelbart med status "Henter..." 
3. Neste gang PCen er på → henter automatisk navn, bilde og pris
4. Annenhver dag oppdateres alle priser automatisk

---

## iPhone-snarvei (gjøres én gang — tar 60 sekunder)

Dette lar deg dele lenker direkte fra Safari, Instagram, osv. til appen:

1. Åpne **Snarveier**-appen på iPhone
2. Trykk **+** øverst til høyre
3. Trykk **"Legg til handling"**
4. Søk etter **"Åpne URL-er"** → velg den
5. I URL-feltet: skriv `https://muhammadfaizankhanjaved1-netizen.github.io/handleliste/?add=`
6. Trykk der du akkurat skrev → trykk **"Snarveiinndata"** i forslags-menyen
   *(URL-feltet skal nå se slik ut: `...handleliste/?add=` + [Snarveiinndata])*
7. Trykk på snarveinavnet øverst → gi den navn: **"Legg i Handleliste"**
8. Trykk **⚙️** → slå på **"Vis i Del-ark"**
9. Trykk **Ferdig**

**Test:** Åpne en Zalando-side i Safari → Del-knapp → "Legg i Handleliste" → appen åpnes med lenken ferdig.

---

## Legg til på hjemskjerm (gjøres én gang)

1. Åpne `https://muhammadfaizankhanjaved1-netizen.github.io/handleliste/` i Safari
2. Trykk Del-ikonet (firkant med pil opp)
3. Velg **"Legg til på hjemskjerm"**
4. Trykk **Legg til**

Appen vises nå som et ikon på hjemskjermen og åpnes uten nettleser-grensesnitt.

---

## PC-oppsett (gjøres én gang)

### 1. Installer Python-pakker
```
cd C:\Users\muham\handleliste
pip install -r requirements.txt
playwright install chromium
```

### 2. Sett opp automatisk oppdatering
Kjør dette i PowerShell (én gang):
```
cd C:\Users\muham\handleliste
.\setup_scheduler.ps1
```

Dette oppretter en Windows-oppgave som:
- Kjører ved PC-oppstart (etter 60 sek)
- Kjører daglig kl. 07:00

### 3. Kjør manuelt
```
cd C:\Users\muham\handleliste
run.bat
```

---

## Oppdater appen

Etter endringer i koden:
```
cd C:\Users\muham\handleliste
git add .
git commit -m "beskrivelse"
git push
```

GitHub Pages oppdateres innen 1–2 min. Telefonen henter ny versjon automatisk ved neste åpning.

---

## Feilsøking

**Varer sitter fast på "Henter..."**
→ PCen har ikke kjørt `process_queue.py` ennå. Kjør `run.bat` manuelt.

**Pris hentes ikke fra Zalando/Boozt**
→ Oppdater selectors i `selectors.json`. Disse nettsidene endrer HTML-struktur innimellom.

**Appen viser ikke ny versjon**
→ Hold inne refresh-knappen i nettleseren (force reload), eller slett appen og installer på nytt.
