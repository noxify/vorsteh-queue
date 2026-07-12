# Audit V2 – Operationalisierbares Architektur-Entscheidungsdokument

Repository: vorsteh-queue  
Branch: refactor  
Datum: 2026-07-12

## Zweck und Entscheidungsfokus

Dieses Dokument priorisiert architekturrelevante Risiken nach Umsetzbarkeit und Wirkung auf:

- API-Stabilität und SemVer-Sicherheit
- Security und Betriebsrobustheit
- Langfristige Evolvierbarkeit bei wachsender Adapter-Anzahl
- Konsistenz zwischen Architekturziel und tatsächlicher Implementierung

## Bewertungsmodell

### Evidence-Level

- Confirmed: Direkt im Code oder in Konfiguration nachweisbar.
- Likely: Stark indiziert durch mehrere Stellen, aber nicht vollständig end-to-end verifiziert.
- Hypothesis: Plausibel, aber mit aktuell verfügbaren Daten nicht ausreichend belegt.

### Confidence-Level

- Sehr hoch: 90-100
- Hoch: 75-89
- Mittel: 55-74
- Niedrig: unter 55

### Severity

- High: V1-Blocker oder hohes Incident-/Breaking-Risiko
- Medium: mittelfristig relevant, aber nicht release-blockend
- Low: technische Schuld oder Konsistenzthema

## Findings-Katalog

## F1 – Unsichere Raw SQL-Konstruktion im Prisma-Adapter

- Status: Closed
- Severity: High
- Evidence-Level: Confirmed
- Confidence-Level: 95
- Status-Hinweis:
  - Security-Picking-Pfad ist strukturell gehärtet (Identifier-Validierung, parametrisierte Werte, LIMIT gebunden).
  - Verbleibender Edge-Case bei leeren IN-Listen ist ein Stabilitäts- und kein Injection-Risiko.
- Kurzbefund:
  - Raw SQL bleibt für FOR UPDATE SKIP LOCKED erhalten, aber alle dynamischen Werte sind im Picking-Pfad parametriert.
  - Schema- und Tabellen-Identifier sind validiert, freie nutzerwertbasierte SQL-Fragment-Interpolation wurde entfernt.
- Security-Relevanz und Exploitability-Kontext:
  - Exploitability ist kontextabhängig, weil Teile der Werte aus internen Handlernamen stammen können.
  - Sobald Name- oder Gruppierungsdaten aus weniger vertrauenswürdigen Pfaden kommen, steigt Angriffsfläche signifikant.
  - Risiko ist unabhängig von sofortiger Exploitierbarkeit High, da der Sicherheitsmechanismus strukturell fehlt.
- Relevante Stellen:
  - [packages/adapter-prisma/src/postgres-adapter.ts](packages/adapter-prisma/src/postgres-adapter.ts#L137)
  - [packages/adapter-prisma/src/postgres-adapter.ts](packages/adapter-prisma/src/postgres-adapter.ts#L140)
  - [packages/adapter-prisma/src/postgres-adapter.ts](packages/adapter-prisma/src/postgres-adapter.ts#L163)
  - [packages/adapter-prisma/src/postgres-adapter.ts](packages/adapter-prisma/src/postgres-adapter.ts#L193)

## F2 – Optional deklarierte OpenTelemetry-Integration ist faktisch hart gekoppelt

- Status: Open
- Severity: High
- Evidence-Level: Confirmed
- Confidence-Level: 88
- Kurzbefund:
  - OTel ist als optionales Peer deklariert, wird aber im Core zur Laufzeit direkt importiert.
  - Queue und Worker initialisieren Telemetry immer beim Erzeugen.
- Security-Relevanz und Exploitability-Kontext:
  - Keine klassische Security-Lücke.
  - Hoher Betriebs- und Distributionsimpact: Laufzeit- und Paketierungsrisiko in Umgebungen ohne OTel.
- Relevante Stellen:
  - [packages/core/package.json](packages/core/package.json#L79)
  - [packages/core/package.json](packages/core/package.json#L84)
  - [packages/core/src/telemetry.ts](packages/core/src/telemetry.ts#L18)
  - [packages/core/src/queue.ts](packages/core/src/queue.ts#L72)
  - [packages/core/src/worker.ts](packages/core/src/worker.ts#L90)

## F3 – Dependency-Feature ist nur teilweise integriert

- Status: Open
- Severity: High
- Evidence-Level: Confirmed
- Confidence-Level: 92
- Kurzbefund:
  - Dependency-Felder sind im Jobmodell vorhanden und werden beim Enqueue gesetzt.
  - Der Worker-Picking-Pfad nutzt keine durchgängige Dependency-Gating-Logik.
  - Failure-Cascade ist als TODO markiert.
- Security-Relevanz und Exploitability-Kontext:
  - Kein Security-Issue.
  - Hohes semantisches Risiko: Nutzer erwarten Abhängigkeitsgarantien, erhalten aber nur Teilverhalten.
- Relevante Stellen:
  - [packages/core/src/queue.ts](packages/core/src/queue.ts#L162)
  - [packages/core/src/dependencies.ts](packages/core/src/dependencies.ts#L33)
  - [packages/core/src/dependencies.ts](packages/core/src/dependencies.ts#L73)
  - [packages/core/src/dependencies.ts](packages/core/src/dependencies.ts#L100)

## F4 – Worker-Picking kann verfügbare Jobs liegenlassen

- Status: Closed
- Severity: High
- Evidence-Level: Confirmed
- Confidence-Level: 86
- Status-Hinweis:
  - Frühzeitige Abbrüche im Picking-Zyklus wurden durch Exclusion/Retry-Verhalten entschärft.
- Kurzbefund:
  - Der kritische break-Pfad im Single-Handler-Picking wurde durch Ausschluss und erneute Selektion ersetzt.
  - Das reduziert Starvation-Risiko bei gemischten Handler-Sets und Rate/Concurrency-Limits.
- Security-Relevanz und Exploitability-Kontext:
  - Keine Security-Lücke.
  - Betriebsrisiko in Lastsituationen und bei Handler-spezifischen Limits.
- Relevante Stellen:
  - [packages/core/src/worker.ts](packages/core/src/worker.ts#L294)
  - [packages/core/src/worker.ts](packages/core/src/worker.ts#L299)
  - [packages/core/src/worker.ts](packages/core/src/worker.ts#L303)

## F5 – Server ist nicht vollständig API-only konsolidiert

- Status: Open
- Severity: Medium
- Evidence-Level: Confirmed
- Confidence-Level: 90
- Kurzbefund:
  - Server-Dokumentation und Konfigurationsmodell enthalten weiterhin Dashboard-Semantik.
  - Öffentliche Konfigurationsroute besteht weiter.
- Security-Relevanz und Exploitability-Kontext:
  - Potenzielles Informationsleck je nach Deployment, da Queue-Namen und Endpoint-Infos exposet werden.
- Relevante Stellen:
  - [packages/server/src/index.ts](packages/server/src/index.ts#L4)
  - [packages/server/src/index.ts](packages/server/src/index.ts#L101)
  - [packages/server/src/config.ts](packages/server/src/config.ts#L28)

## F6 – Root-Dokumentation widerspricht Zielbild

- Status: Closed
- Severity: Medium
- Evidence-Level: Confirmed
- Confidence-Level: 98
- Status-Hinweis:
  - Root-README wurde auf GraphQL API-Narrativ ohne Dashboard-Web-UI-Claim aktualisiert.
- Kurzbefund:
  - Root-README ist auf das aktuelle API-Narrativ ausgerichtet.
  - Der frühere Dashboard/Web-UI-Widerspruch wurde dort bereinigt.
- Relevante Stellen:
  - [README.md](README.md#L20)
  - [README.md](README.md#L30)

## F7 – Subscription-Pfad im Server ist unvollständig verdrahtet

- Status: Open
- Severity: Medium
- Evidence-Level: Likely
- Confidence-Level: 72
- Kurzbefund:
  - Subscription-Seite ist vorhanden, produktiver Publish-Pfad ist in den inspizierten Server-Dateien nicht sichtbar.
- Warum nicht Confirmed:
  - Publish kann theoretisch außerhalb der betrachteten Pfade erfolgen.
- Relevante Stellen:
  - [packages/server/src/api/schema.ts](packages/server/src/api/schema.ts#L407)
  - [packages/server/src/api/schema.ts](packages/server/src/api/schema.ts#L413)
  - [packages/server/src/api/pubsub.ts](packages/server/src/api/pubsub.ts#L25)

## F8 – Tooling-Migration vollständig, aber Turbo-Artefaktkonvention inkonsistent

- Status: Closed
- Severity: Low
- Evidence-Level: Confirmed
- Confidence-Level: 94
- Status-Hinweis:
  - Turbo-Outputs für format/lint referenzieren keine alten ESLint/Prettier-Cache-Dateien mehr.
- Kurzbefund:
  - oxlint und oxfmt sind etabliert.
  - Die bisherigen Turbo-Referenzen auf alte ESLint/Prettier-Artefakte wurden entfernt.
- Relevante Stellen:
  - [turbo.json](turbo.json#L19)
  - [turbo.json](turbo.json#L23)

## F9 – CLI-zu-Server-Kopplung ist Produktentscheidung mit Trade-offs

- Status: Open
- Severity: Low
- Evidence-Level: Confirmed
- Confidence-Level: 83
- Kurzbefund:
  - CLI referenziert Server-Paket, unter anderem für serve-Use-Case.
  - Das ist nicht per se falsch, aber erhöht Kopplung und Distribution-Footprint.
- Relevante Stellen:
  - [packages/cli/package.json](packages/cli/package.json#L54)
  - [packages/cli/src/commands/serve.ts](packages/cli/src/commands/serve.ts#L13)

## High-Risk-Gegenentwürfe und minimal-invasive Umsetzungsstrategie

## H1 – Gegenentwurf zu F1 (Prisma Raw SQL)

### Zielarchitektur

- Adapter nutzt nur parametrisierte Query-Bausteine.
- Keine manuelle String-Konkatenation mit SQL-Syntax.
- Einheitliches Sicherheitsprinzip über alle Adapter hinweg.

### Minimal-invasive Umsetzung

1. Interpolierte IN-Listen durch parametrisierte Platzhalter ersetzen.
2. LIMIT nicht als String einsetzen, sondern als validierte numerische Bindung.
3. Input-Normalisierung für Handler- und Group-Listen ergänzen.
4. Regressionstests mit schädlichen Spezialzeichen in Namen und Gruppen hinzufügen.

### Messbare Exit-Kriterien

- 0 Treffer für queryRawUnsafe mit String-Konkatenation in Adapter-Prisma.
- Adapter-Tests bestehen inklusive neuer Injection-Regressionstests.
- Sicherheits-Review bestätigt ausschließlich parametrisierte SQL-Pfade.

## H2 – Gegenentwurf zu F2 (OTel Optionalität)

### Zielarchitektur

- Core läuft vollständig ohne OTel-Installation.
- Telemetry ist ein klar optionaler Capability-Pfad.
- Observability bleibt als Cross-Cutting Concern integriert, aber entkoppelt.

### Minimal-invasive Umsetzung

1. Telemetry-Fabrik in lazy initialisierten Provider mit Fallback auf Noop kapseln.
2. Direkte harte Imports auf deferred loading oder explizite optional config umstellen.
3. CI-Matrix um Szenario ohne OTel-Paket ergänzen.

### Messbare Exit-Kriterien

- Core startet und verarbeitet Jobs ohne OTel-Paketinstallation.
- Testsuite besteht in zwei Modi: mit OTel und ohne OTel.
- Dokumentation enthält klare Capability- und Fallback-Beschreibung.

## H3 – Gegenentwurf zu F3 (Dependency-Semantik)

### Zielarchitektur

- Dependencies sind entweder vollständig garantiert oder explizit als nicht stabil markiert.
- Picking, Statusübergänge und Failure-Cascade sind konsistent.

### Minimal-invasive Umsetzung

1. Entscheidung treffen: stabile Feature-Garantie oder temporäres Feature-Flag.
2. Falls stabil: Dependency-Checks in Picking-Pfad integrieren.
3. Failure-Cascade finalisieren, inklusive Adapter-Vertragserweiterung falls nötig.
4. Contract-Tests in shared-tests um Dependency-Szenarien erweitern.

### Messbare Exit-Kriterien

- End-to-end Tests beweisen: Job mit offenen Dependencies wird nicht verarbeitet.
- Tests beweisen definierte Reaktion bei Dependency-Failure.
- Public API und Dokumentation stimmen zu 100 Prozent mit tatsächlichem Verhalten überein.

## H4 – Gegenentwurf zu F4 (Worker-Picking und Starvation)

### Zielarchitektur

- Picking-Schleife arbeitet fair und robust bei Handler-Limits und Rate-Limits.
- Verfügbare Jobs werden nicht durch frühzeitige Abbrüche blockiert.

### Minimal-invasive Umsetzung

1. break-Pfade in continue oder reselection umstellen, wo sinnvoll.
2. Schleifenlogik um klare Abbruchkriterien erweitern, die nur bei echter Erschöpfung greifen.
3. Lasttests für gemischte Handler-Pools ergänzen.

### Messbare Exit-Kriterien

- Lasttest zeigt keine künstliche Starvation bei verarbeitbaren Jobs.
- Durchsatz steigt in Mixed-Handler-Szenarien nachweisbar.
- Keine Regression in bestehenden Worker-Tests.

## Priorisierte Roadmap

## 0-14 Tage

### Maßnahmen

1. F1 sofort härten (parametrisierte SQL-Pfade im Prisma-Adapter).
2. F4 Worker-Picking-Schleife korrigieren.
3. F6 Root-README mit API-only-Narrativ synchronisieren.
4. F8 Turbo-Artefaktkonvention bereinigen.

### Exit-Kriterien

- Security-Checkliste für SQL abgeschlossen, neue Tests grün.
- Worker-Regression- und Last-Basistests grün.
- README ohne Dashboard-Claims, konsistent zum Server-Zielbild.
- Turbo-Config referenziert nur aktuelle Tooling-Artefakte.

## 30 Tage

### Maßnahmen

1. F2 OTel-Optionalität technisch sauber entkoppeln.
2. F3 Dependency-Entscheidung und erste vollständige Umsetzung.
3. F7 Subscription-Architektur verifizieren und ggf. publish wiring ergänzen.
4. Transport-Parität Direct versus GraphQL als Contract-Testset ergänzen.

### Exit-Kriterien

- CI-Matrix läuft erfolgreich mit und ohne OTel.
- Dependency-E2E-Verhalten ist spezifiziert und testbar stabil.
- Subscription-E2E-Test beweist reale Event-Zustellung.
- Transport-Paritätstests bestehen für Kernkommandos.

## 90 Tage

### Maßnahmen

1. Service-Layer zwischen API/CLI und Adaptern etablieren.
2. Adapter-Contract-Kit mit Compliance-Suite formalisieren.
3. ADR-System für Architekturentscheidungen verbindlich einführen.
4. SemVer-Governance für Public Surfaces operationalisieren.

### Exit-Kriterien

- Service-Layer wird von GraphQL und CLI als einziger Business-Einstieg genutzt.
- Jeder Adapter besteht dieselbe Compliance-Suite.
- Mindestens 6 zentrale ADRs vorhanden und im Repo referenziert.
- Release-Checkliste enthält Breaking-Surface-Audit pro Package.

## Maßnahmen-Matrix mit messbaren Exit-Kriterien

| Maßnahme | Risiko-Bezug | Owner-Vorschlag | Messbarer Abschluss |
| --- | --- | --- | --- |
| Prisma SQL härten | F1 | Adapter Maintainer | Keine unsicheren Raw SQL-Interpolationen, Security-Tests grün |
| Worker-Picking korrigieren | F4 | Core Maintainer | Kein Starvation-Nachweis in Lasttests |
| OTel entkoppeln | F2 | Core Maintainer | Core läuft in CI ohne OTel-Abhängigkeit |
| Dependency-Semantik abschließen | F3 | Core + Adapter Maintainer | E2E-Vertragstests für Dependencies grün |
| Server API-only konsolidieren | F5 | Server Maintainer | Keine Dashboard-Reste in API-Package-Doku/Surface |
| Subscriptions vervollständigen | F7 | Server Maintainer | Subscription-E2E mit produktivem Publish grün |
| Doku-Synchronisierung | F6 | Docs Maintainer | Root + Package + Docs konsistent zum Ist-Verhalten |
| Transport-Parität testen | F9/F7 | CLI Maintainer | Gleiches Ergebnisprofil Direct vs GraphQL |
| ADR-Programm | Governance | Architekt/Tech Lead | ADR-Katalog verfügbar und in CONTRIBUTING verankert |

## Überbewertete Punkte (explizit)

1. CLI-zu-Server-Kopplung wurde tendenziell überbewertet.
   - Diese Kopplung kann für den Serve-Use-Case bewusst und akzeptabel sein.
2. Turbo-Cache-Namensinkonsistenz wurde strategisch zu hoch gewichtet.
   - Wichtig für Hygiene, aber kein v1-Blocker.
3. PubSub asyncDispose-Implementierung mit Throw wurde zu prominent priorisiert.
   - Fehlerhaft, aber im Vergleich zu Security und Feature-Semantik nachrangig.

## Unterbewertete Punkte (explizit)

1. Security-Härtung im Prisma-Adapter ist noch kritischer als initial gewichtet.
   - Sollte als unmittelbarer Release-Blocker behandelt werden.
2. Dependency-Semantik als potenzielles Vertrauensproblem für API-Konsumenten war untergewichtet.
   - Hohe Relevanz für Open-Source-Vertrauen und SemVer-Stabilität.
3. Transport-Parität Direct versus GraphQL wurde unterbewertet.
   - Divergenzen erzeugen schwer diagnostizierbare Produktionsprobleme.
4. OTel-Optionalität als Distributionsrisiko wurde unterbewertet.
   - Besonders relevant für minimale Deployments und Tooling-Ökosysteme.

## Entscheidungsreife und nächste Steuerungsentscheidung

Aktueller Reifegrad für v1-Freeze: bedingt geeignet.  
Empfehlung:

- Keine finalen Release-Kandidaten, bevor F1 und F3 auf Confirmed-Fix-Status stehen.
- F2 und F4 spätestens im 30-Tage-Fenster abschließen.
- Danach Governance-Phase mit ADR, Contract-Kit und SemVer-Gates starten.

## Verifikation und Transparenz

Dieses Audit V2 wurde auf Basis von Code- und Konfigurationsanalyse erstellt.  
Für finale Freigabe wird eine ergänzende Validierung mit:

- vollständigem Testlauf
- gezieltem Security-Test für Adapter-Prisma
- optionalen Runtime-Matrix-Tests für OTel

empfohlen.
