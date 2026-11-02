<!--
SPDX-FileCopyrightText: 2026 Ján Letko / LTK Solutions
SPDX-License-Identifier: EUPL-1.2
-->

# ADR-045 — Rola `people-admin` sa premenúva na `admin` („Administrátor")

> **Stav:** prijaté · **Dátum:** 2026-11-02
> **Rozhodol:** Ján Letko (2026-11-02) — „navrhujem premenovať rolu
> people-admin iba na admin, po slovensky Správca alebo Administrátor";
> z dvoch názvov zvolil odporúčaný **„Administrátor"**.
> **Nadväzuje na:** D46 (vlastná rola pre správu osôb), D55 (číselníky
> organizácie), postup pri `spravca-obsahu` → `content-admin`.
> **Rozhodnutie:** D296

---

## Kontext

Rola `people-admin` vznikla v D46 pre toho, kto zakladá a vyraďuje osoby.
Odvtedy k nej pribudlo všetko, čo patrí organizácii: oddelenia, číselníky
(a od 2. 11. 2026 aj nový Druh pri nahrávaní), nastavenia, AI, zdroje,
právne základy, odvolanie pripojených asistentov. Názov „spravuje osoby
(táto obrazovka)" už nehovoril pravdu a v textoch rozhrania sa pre ňu
používalo „správca osôb" aj „správca organizácie".

## Rozhodnutie

1. Kľúč roly je **`admin`**, na obrazovke **„Administrátor"** (cs
   „Administrátor", en „Administrator"). „Správca" sa nepoužil, lebo by sa
   plietol so „správcom obsahu", „správcom ticketov" a „správcom číselníkov".
   S `platform-admin` (správca celej platformy) sa nezrazí.
2. Kľúč je **dáto v `persons.roles`**, takže sa mení migráciou
   (`npm run migrate:role-admin`, predvolene náhľad), nie refaktorom.
3. **Kód uznáva obe označenia naraz** (`LEGACY_ADMIN_ROLE`, `isOrgAdmin`,
   `normalizeRoles` v `lib/people.ts`). Nasadenie preto nikomu nezoberie
   prístup; migrácia beží potom. Uloženie osoby starý kľúč samo nahradí novým.
4. **Audit sa neprepisuje** (D24). Starý kľúč v záznamoch prekladá `i18n.ts`
   na ten istý názov „Administrátor".
5. Keď migrácia prebehne a `npm run check` starý kľúč nenájde, `people-admin`
   z kódu vypadne a `check.mjs` ho začne hlásiť ako staré označenie (ako
   `spravca-obsahu`).

## Dôsledky

- V kóde: `PEOPLE_ROLE` → `ADMIN_ROLE`, `isPeopleAdmin` → `isOrgAdmin`.
- Komentáre a dokumentácia, ktoré hovoria o role, používajú `admin`; staršie
  plány a archív v `docs/` ostávajú, ako boli napísané.
