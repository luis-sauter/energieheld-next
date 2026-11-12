export type TravelPlanning = {
  title: string;
  description: string;
  heading: string;
  lead: string;
  tips: readonly { title: string; text: string }[];
};

// Practical editorial guidance, not a promise about an individual host's facilities.
export const travelPlanning: Record<string, TravelPlanning> = {
  deutschland: {
    title: 'Urlaub in Deutschland – Reiseziele und Unterkünfte',
    description: 'Unterkünfte in Deutschland entdecken: Reiseideen zwischen Küste und Alpen, Gastgeberprofile und Tipps zur Wahl von Region, Lage und Unterkunft.',
    heading: 'Welche Region passt zu Ihrem Deutschlandurlaub?',
    lead: 'Für Urlaub in Deutschland können Sie zuerst die Landschaft und dann den passenden Ausgangspunkt wählen: Küste, Flusstal, Mittelgebirge oder Alpenraum. Vergleichen Sie die Lage der Gastgeber mit Ihren geplanten Ausflügen.',
    tips: [
      { title: 'Küste oder Binnenland?', text: 'Für Urlaub am Wasser ist die Entfernung zum tatsächlichen Strand oder Seezugang entscheidend. Für Wander- und Radurlaub prüfen Sie den Anschluss an geeignete Wege statt nur den Namen der Urlaubsregion.' },
      { title: 'Kurzurlaub oder längerer Aufenthalt?', text: 'Bei wenigen freien Tagen lohnt ein Blick auf die Anreisezeit. Für einen längeren Aufenthalt kann ein fester Ausgangspunkt sinnvoll sein, von dem mehrere Ausflugsziele erreichbar sind.' },
      { title: 'Unterkünfte vergleichen', text: 'Nutzen Sie die Angaben zu Standort, Unterkunftsart und Reisethemen in den Profilen. Verfügbarkeit, konkrete Leistungen und den Gesamtpreis bestätigen Sie direkt beim Gastgeber.' },
    ],
  },
  oesterreich: {
    title: 'Urlaub in Österreich – Unterkünfte zwischen Bergen und Seen',
    description: 'Gastgeber in Österreich vergleichen: Unterkünfte für Berg-, See- und Winterurlaub sowie praktische Hinweise zu Lage, Anreise und Reisezeit.',
    heading: 'So wählen Sie Ihren Ausgangspunkt in Österreich',
    lead: 'Für Urlaub in Österreich macht es einen Unterschied, ob Sie am See, im Tal oder in einem Bergort wohnen. Wählen Sie die Unterkunft nach Ihren geplanten Aktivitäten und prüfen Sie die Wege dorthin.',
    tips: [
      { title: 'Berg- und Seetage planen', text: 'Vergleichen Sie die Lage mit Wanderwegen, Seezugängen oder Ausflugszielen. Ein Ortsname allein sagt noch nichts über die Entfernung zur gewünschten Aktivität aus.' },
      { title: 'Sommer und Winter unterscheiden', text: 'Wanderwege, Bergbahnen und Straßen sind nicht zu jeder Jahreszeit gleich nutzbar. Prüfen Sie vor der Anreise die aktuellen Bedingungen bei den örtlichen Betreibern.' },
      { title: 'Leistungen konkret abgleichen', text: 'Klären Sie mit dem Gastgeber, welche Verpflegung, Parkmöglichkeiten oder Zusatzleistungen enthalten sind. Eine thematische Zuordnung ersetzt keine Bestätigung des gebuchten Angebots.' },
    ],
  },
  schweiz: {
    title: 'Urlaub in der Schweiz – Unterkünfte an Seen und in den Alpen',
    description: 'Unterkünfte in der Schweiz entdecken und Lage, Anreise und Reisepläne vergleichen: Gastgeber für Auszeiten an Seen, in Bergorten und im Tessin.',
    heading: 'Was ist bei der Unterkunftswahl in der Schweiz wichtig?',
    lead: 'Für Urlaub in der Schweiz lohnt es sich, Seeufer, Bergort und Talstandort getrennt zu vergleichen. Entscheidend ist, wie Sie Ihre geplanten Ziele von der Unterkunft aus erreichen.',
    tips: [
      { title: 'Anreise und Wege vor Ort', text: 'Prüfen Sie die Verbindung zwischen Bahnhof oder Parkplatz und Unterkunft. Für Ausflüge vergleichen Sie Fahrzeiten und Umstiege; eine kurze Luftlinie kann im Gebirge täuschen.' },
      { title: 'Reisezeit berücksichtigen', text: 'Ein Bergziel ist im Winter anders erreichbar als im Sommer. Aktuelle Öffnungszeiten und die Betriebszeiten von Bergbahnen klären Sie bei den jeweiligen Betreibern.' },
      { title: 'Angebote vergleichbar machen', text: 'Achten Sie auf die angegebene Währung, Verpflegung und mögliche Zusatzkosten. Lassen Sie sich Verfügbarkeit und Gesamtpreis für Ihren konkreten Zeitraum bestätigen.' },
    ],
  },
  'suedtirol-italien': {
    title: 'Südtirol/Italien – Urlaub und passende Unterkünfte',
    description: 'Gastgeber in Südtirol und Italien entdecken: Unterkunftslage, Tal- oder Bergstandort und Reisepläne für Wandern, Radfahren und Erholung vergleichen.',
    heading: 'Den passenden Standort in Südtirol und Italien finden',
    lead: 'Südtirol und Italien umfassen unterschiedliche Urlaubslandschaften. Prüfen Sie bei jedem Profil den tatsächlichen Ort: Ein Gastgeber in Italien liegt nicht automatisch in Südtirol oder in den Dolomiten.',
    tips: [
      { title: 'Region und Ort abgleichen', text: 'Vergleichen Sie die Adresse mit Ihren geplanten Ausflugszielen. Für Tage in den Bergen sind Höhenlage und Talverbindung hilfreicher als eine allgemeine Länderzuordnung.' },
      { title: 'Aktivitäten passend auswählen', text: 'Für Wander- und Radurlaub prüfen Sie die Wege ab Unterkunft. Für Winterreisen klären Sie die Verbindung zum gewünschten Skigebiet und die aktuellen Betriebszeiten.' },
      { title: 'Den Aufenthalt abstimmen', text: 'Fragen Sie beim Gastgeber nach Verpflegung, Anreisebedingungen und den enthaltenen Leistungen. Angaben im Profil helfen bei der Vorauswahl; verbindlich ist das konkrete Angebot.' },
    ],
  },
  'natur-pur': {
    title: 'Natur pur – Unterkünfte für Natururlaub',
    description: 'Unterkünfte für Natururlaub entdecken. Vergleichen Sie Lage, Umgebung und Gastgeber für ruhige Auszeiten, Waldwege und Tage am Wasser.',
    heading: 'Wie finden Sie eine Unterkunft für Natururlaub?',
    lead: 'Für Natururlaub zählt die Umgebung der Unterkunft: Welche Landschaft möchten Sie erleben, und wie erreichen Sie sie? Ein ruhiger Ausgangspunkt und passende Wege helfen bei der Planung Ihrer Auszeit.',
    tips: [
      { title: 'Lage statt Landschaftsversprechen', text: 'Prüfen Sie den tatsächlichen Standort und die Wege zu Wald, Wiesen oder Ufern. Ein Landschaftsbild allein belegt keine ruhige Lage oder einen direkten Naturzugang.' },
      { title: 'Den Tag im eigenen Tempo planen', text: 'Wählen Sie Spaziergänge und Ausflüge nach Kondition, Jahreszeit und Wetter. Informieren Sie sich vor Ort über Wegsperrungen und Regeln in Schutzgebieten.' },
      { title: 'Beim Gastgeber nachfragen', text: 'Klären Sie, welche Ausgangspunkte ohne Auto erreichbar sind und welche Ruhebedingungen zu erwarten sind. Die Ausstattung entnehmen Sie dem jeweiligen Unterkunftsangebot.' },
    ],
  },
  'nordic-walking': {
    title: 'Nordic Walking – Gastgeber für Ihren Aktivurlaub',
    description: 'Gastgeber für Nordic-Walking-Urlaub entdecken. Unterkunftslage, Untergrund, Steigungen und mögliche Runden für Ihre Reise vergleichen.',
    heading: 'Worauf kommt es beim Nordic-Walking-Urlaub an?',
    lead: 'Für Nordic-Walking-Urlaub sind gut erreichbare Runden und ein zu Ihrer Kondition passender Untergrund wichtig. Vergleichen Sie die Lage der Unterkunft mit den Wegen, die Sie tatsächlich nutzen möchten.',
    tips: [
      { title: 'Strecken passend wählen', text: 'Prüfen Sie Länge, Höhenmeter und Wegbeschaffenheit. Eine kurze Runde mit viel Steigung kann anspruchsvoller sein als eine längere Strecke im flachen Gelände.' },
      { title: 'Startpunkt prüfen', text: 'Fragen Sie nach Wegen ab Unterkunft und nach aktuellen örtlichen Streckeninformationen. Eine Zuordnung zum Reisethema bedeutet nicht automatisch, dass Kurse angeboten werden.' },
      { title: 'Ausrüstung und Angebote klären', text: 'Falls Sie Stöcke leihen oder eine Anleitung buchen möchten, lassen Sie sich Verfügbarkeit und Kosten vorab bestätigen.' },
    ],
  },
  radwandern: {
    title: 'Radwandern – Unterkünfte für Ihren Radurlaub',
    description: 'Unterkünfte für Radurlaub vergleichen: Ausgangspunkte, Etappen, Fahrradunterbringung und Gastgeber für Ihre geplanten Radtouren entdecken.',
    heading: 'Eine Unterkunft für Radurlaub auswählen',
    lead: 'Bei Radurlaub entscheidet zuerst die Reiseform: Möchten Sie täglich von derselben Unterkunft starten oder von Etappe zu Etappe weiterfahren? Danach richten sich Lage, Gepäckplanung und die Auswahl der Gastgeber.',
    tips: [
      { title: 'Runden oder Etappen?', text: 'Für Rundtouren ist ein Standort mit mehreren erreichbaren Wegen hilfreich. Bei einer Etappenreise stimmen Sie Übernachtungen und Tagesstrecken aufeinander ab.' },
      { title: 'Fahrrad sicher unterbringen', text: 'Fragen Sie nach einer geeigneten Abstellmöglichkeit. Für E-Bikes klären Sie zusätzlich die Lademöglichkeiten; eine Zuordnung zu Radwandern garantiert diese Ausstattung nicht.' },
      { title: 'Strecke und Anreise planen', text: 'Vergleichen Sie Untergrund, Höhenmeter und aktuelle Wegbedingungen. Bei Anreise mit der Bahn prüfen Sie die Regeln und Reservierungsmöglichkeiten für die Fahrradmitnahme.' },
    ],
  },
  wanderurlaub: {
    title: 'Wanderurlaub – Unterkünfte und Ausgangspunkte entdecken',
    description: 'Unterkünfte für Wanderurlaub vergleichen: Lage zu Wanderwegen, Höhenmeter, Reisezeit und Gastgeber für Ihre persönliche Tourenplanung.',
    heading: 'Wie wählen Sie den Ausgangspunkt für Wanderurlaub?',
    lead: 'Für Wanderurlaub sollte die Unterkunft zu den geplanten Touren passen. Prüfen Sie nicht nur die Region, sondern auch den Weg zum Tourenstart sowie Schwierigkeit, Höhenmeter und Jahreszeit.',
    tips: [
      { title: 'Touren nach Erfahrung auswählen', text: 'Gehzeit und Kilometer allein reichen für die Einschätzung nicht aus. Beziehen Sie Untergrund, Steigung, Wetter und Ihre persönliche Erfahrung in die Planung ein.' },
      { title: 'Wege ab Unterkunft prüfen', text: 'Klären Sie, ob Sie direkt losgehen können oder eine Anfahrt nötig ist. Fragen Sie bei Bedarf nach örtlichen Verbindungen zu den Ausgangspunkten.' },
      { title: 'Aktuelle Bedingungen beachten', text: 'Informieren Sie sich vor jeder Tour über Wetter, Wegsperrungen und gegebenenfalls Bergbahnbetrieb. Allgemeine Reiseideen ersetzen keine aktuelle Toureninformation.' },
    ],
  },
  familienurlaub: {
    title: 'Familienurlaub – Unterkünfte für gemeinsame Urlaubstage',
    description: 'Unterkünfte für Familienurlaub entdecken und Zimmeraufteilung, Verpflegung, Lage und konkrete Leistungen für Kinder beim Gastgeber vergleichen.',
    heading: 'Was macht eine Unterkunft passend für Ihre Familie?',
    lead: 'Für Familienurlaub sind Alter der Kinder, Zimmeraufteilung und Alltag vor Ort entscheidend. Vergleichen Sie konkrete Leistungen statt sich allein auf die Bezeichnung familienfreundlich zu verlassen.',
    tips: [
      { title: 'Platz und Schlafmöglichkeiten', text: 'Klären Sie die Zahl der Schlafplätze, getrennte Räume und die Verfügbarkeit eines Kinderbetts. Fotos allein zeigen nicht, welche Zimmerkategorie Sie buchen.' },
      { title: 'Verpflegung und Tagesablauf', text: 'Prüfen Sie Essenszeiten oder Kochmöglichkeiten und die Wege zu Ihren Ausflugszielen. Kurze Wege können den Alltag mit Kindern erleichtern.' },
      { title: 'Angebote für Kinder bestätigen', text: 'Fragen Sie nach Altersgrenzen, Öffnungszeiten und möglichen Kosten. Betreuung, Spielbereiche oder Kinderprogramme sind nur enthalten, wenn der Gastgeber dies ausdrücklich anbietet.' },
    ],
  },
  golfurlaub: {
    title: 'Golfurlaub – Gastgeber und Unterkünfte vergleichen',
    description: 'Unterkünfte für Golfurlaub entdecken. Entfernung zum Golfplatz, Startzeiten, Greenfees und Leistungen direkt mit Gastgeber und Golfplatz abstimmen.',
    heading: 'Unterkunft und Golfpläne aufeinander abstimmen',
    lead: 'Für Golfurlaub vergleichen Sie die Unterkunft mit den Plätzen, auf denen Sie spielen möchten. Eine thematische Zuordnung bedeutet nicht automatisch, dass ein eigener Golfplatz oder Greenfees enthalten sind.',
    tips: [
      { title: 'Lage zum gewünschten Platz', text: 'Prüfen Sie Fahrzeit und Anreisemöglichkeiten zum Golfplatz. Stimmen Sie den Standort auch auf die Interessen nicht spielender Mitreisender ab.' },
      { title: 'Startzeiten und Voraussetzungen', text: 'Klären Sie beim Golfplatz die Buchung von Startzeiten, Spielvoraussetzungen und aktuelle Platzbedingungen für Ihren Reisezeitraum.' },
      { title: 'Leistungen und Kosten', text: 'Lassen Sie sich enthaltene Greenfees oder Transfers ausdrücklich bestätigen. Vergleichen Sie Übernachtung und Golfleistungen als Gesamtangebot.' },
    ],
  },
  'urlaub-am-wasser': {
    title: 'Urlaub am Wasser – Unterkünfte an See, Fluss und Küste',
    description: 'Gastgeber für Urlaub am Wasser entdecken. Lage zu See, Fluss oder Küste sowie Uferzugang und konkrete Möglichkeiten vor Ort vergleichen.',
    heading: 'See, Fluss oder Küste: Was passt zu Ihrem Urlaub?',
    lead: 'Urlaub am Wasser kann ein Strandtag, eine Kanutour oder ein Spaziergang am Ufer sein. Wählen Sie zuerst Ihre gewünschte Aktivität und prüfen Sie dann den tatsächlichen Zugang von der Unterkunft aus.',
    tips: [
      { title: 'Uferzugang prüfen', text: 'Eine Lage in Seenähe bedeutet nicht automatisch einen eigenen Strand oder Badezugang. Vergleichen Sie Entfernung, Erreichbarkeit und die Regeln am gewünschten Ufer.' },
      { title: 'Aktivitäten abstimmen', text: 'Für Baden, Paddeln oder Wassersport prüfen Sie aktuelle örtliche Bedingungen und erlaubte Bereiche. Verleih und Kurse sind gesondert zu bestätigen.' },
      { title: 'Reisezeit berücksichtigen', text: 'Klären Sie, welche Angebote in Ihrem Reisezeitraum geöffnet sind. Für einen ruhigen Aufenthalt können Spazierwege und Ausflugsziele ebenso wichtig sein wie Bademöglichkeiten.' },
    ],
  },
  campingurlaub: {
    title: 'Campingurlaub – Campingplätze und Unterkünfte entdecken',
    description: 'Campingurlaub mit Zelt, Wohnwagen oder Reisemobil planen: Gastgeber entdecken und Stellplatz, Anschlüsse, Sanitärbereiche und Lage vergleichen.',
    heading: 'Welcher Campingplatz passt zu Ihrer Reise?',
    lead: 'Beim Campingurlaub richtet sich die Platzwahl nach Zelt, Wohnwagen, Reisemobil oder gewünschter Mietunterkunft. Prüfen Sie, welche Übernachtungsform der jeweilige Gastgeber tatsächlich anbietet.',
    tips: [
      { title: 'Platz und Anschlüsse', text: 'Klären Sie Stellplatzgröße, Untergrund sowie Strom- und Wasserversorgung. Fragen Sie bei größeren Fahrzeugen nach Zufahrt und möglichen Beschränkungen.' },
      { title: 'Ausstattung und Saison', text: 'Vergleichen Sie Sanitärbereiche, Verpflegungsmöglichkeiten und Öffnungszeiten. Für Wintercamping sind die tatsächlich geöffneten Einrichtungen besonders wichtig.' },
      { title: 'Gesamtpreis und Reservierung', text: 'Lassen Sie sich den Preis einschließlich Personen, Fahrzeug, Strom und möglicher Zusatzkosten bestätigen. Regeln für Haustiere und Ankunftszeiten klären Sie vor der Buchung.' },
    ],
  },
  'romantik-zu-zweit': {
    title: 'Romantik zu zweit – Unterkünfte für Ihre Auszeit',
    description: 'Unterkünfte für Urlaub zu zweit vergleichen: ruhige Auszeiten, gemeinsame Aktivitäten und konkrete Angebote der Gastgeber entdecken.',
    heading: 'Wie planen Sie eine Auszeit zu zweit?',
    lead: 'Urlaub zu zweit passt dann, wenn Umgebung und Unterkunft Ihren gemeinsamen Wünschen entsprechen. Entscheiden Sie, ob Ruhe, Stadtleben, Natur oder ein bestimmtes Angebot im Mittelpunkt stehen soll.',
    tips: [
      { title: 'Die gewünschte Atmosphäre', text: 'Vergleichen Sie Lage und Zimmerangebot. Fragen Sie bei Bedarf gezielt nach Ruhebedingungen; eine romantische Gestaltung sagt darüber allein wenig aus.' },
      { title: 'Gemeinsame Zeit planen', text: 'Wählen Sie wenige Aktivitäten, die Ihnen beiden gefallen. Prüfen Sie Wege zu Spaziergängen, Restaurants oder anderen geplanten Zielen.' },
      { title: 'Extras konkret buchen', text: 'Ein Abendessen, eine Anwendung oder besondere Zimmerausstattung ist nicht automatisch enthalten. Lassen Sie sich gewünschte Leistungen und Zeiten bestätigen.' },
    ],
  },
  wellnessangebote: {
    title: 'Wellnessangebote – Unterkünfte für Ihre Erholung',
    description: 'Gastgeber für Wellnessurlaub entdecken. Sauna, Anwendungen, Ruhebereiche und enthaltene Leistungen anhand der konkreten Unterkunftsangebote vergleichen.',
    heading: 'Welche Wellnessleistungen sind Ihnen wichtig?',
    lead: 'Für Wellnessurlaub lohnt ein genauer Vergleich der angebotenen Leistungen. Ein Ruhebereich, eine Sauna und eine buchbare Anwendung sind unterschiedliche Angebote und nicht bei jedem Gastgeber gleichermaßen vorhanden.',
    tips: [
      { title: 'Ausstattung prüfen', text: 'Sehen Sie im Profil nach, welche Einrichtungen tatsächlich beschrieben sind. Fotos oder eine thematische Zuordnung ersetzen keine konkrete Leistungsbeschreibung.' },
      { title: 'Zugang und Zeiten', text: 'Klären Sie Öffnungszeiten, Altersgrenzen und gegebenenfalls Reservierungen. Fragen Sie nach, ob alle Einrichtungen während Ihres Aufenthalts nutzbar sind.' },
      { title: 'Inklusive oder zusätzlich?', text: 'Vergleichen Sie, welche Nutzung im Übernachtungspreis enthalten ist. Anwendungen, private Bereiche oder bestimmte Termine können gesondert zu buchen sein.' },
    ],
  },
  geschaeftsreisen: {
    title: 'Geschäftsreisen – Passende Unterkünfte und Gastgeber',
    description: 'Unterkünfte für Geschäftsreisen vergleichen: Lage zum Termin, Anreise, Arbeitsmöglichkeiten, Check-in und Rechnungsstellung direkt abstimmen.',
    heading: 'Eine Unterkunft für Ihre Geschäftsreise finden',
    lead: 'Für Geschäftsreisen zählt die Verbindung zwischen Unterkunft, Termin und Anreise. Prüfen Sie die tatsächliche Fahrzeit und die Abläufe vor Ort, damit die Unterkunft zu Ihrem Zeitplan passt.',
    tips: [
      { title: 'Lage zum Termin', text: 'Vergleichen Sie die Adresse mit Ihrem Ziel sowie den Verkehrsverbindungen zu den benötigten Zeiten. Zentrale Lage bedeutet nicht automatisch kurze Wege zum konkreten Termin.' },
      { title: 'Arbeiten und Ankommen', text: 'Klären Sie WLAN, Arbeitsplatz und mögliche späte Ankunft direkt mit dem Gastgeber. Besprechungsräume sind nur verfügbar, wenn sie ausdrücklich angeboten und bestätigt werden.' },
      { title: 'Buchung und Abrechnung', text: 'Stimmen Sie Rechnungsadresse, enthaltene Leistungen sowie Änderungs- und Stornobedingungen vorab ab. Bei mehreren Reisenden klären Sie die Buchung aller benötigten Zimmer.' },
    ],
  },
  skifahren: {
    title: 'Skiurlaub – Unterkünfte und Gastgeber für Wintertage',
    description: 'Unterkünfte für Skiurlaub entdecken. Pistenanbindung, Skibus, Ausrüstungsunterbringung und die konkreten Leistungen der Gastgeber vergleichen.',
    heading: 'Worauf achten Sie bei einer Unterkunft für Skiurlaub?',
    lead: 'Für Skiurlaub ist die tatsächliche Verbindung zum gewünschten Skigebiet entscheidend. Vergleichen Sie Pisten- oder Liftzugang, mögliche Skibusverbindungen und die angebotenen Leistungen der Unterkunft.',
    tips: [
      { title: 'Wege zur Piste', text: 'Prüfen Sie Entfernung und Verkehrsmittel zum Lift. Ski-in/Ski-out sollten Sie sich für die konkrete Unterkunft und die örtlichen Bedingungen bestätigen lassen.' },
      { title: 'Ausrüstung und Kurse', text: 'Fragen Sie bei Bedarf nach Skiraum oder Trocknungsmöglichkeiten. Verleih, Kurse und Skipässe sind nicht automatisch im Unterkunftspreis enthalten.' },
      { title: 'Aktuelle Wintersituation', text: 'Prüfen Sie Schneebericht, Liftbetrieb und Anreisebedingungen kurz vor der Reise. Eine allgemeine Beschreibung des Skiangebots ist keine Schneegarantie.' },
    ],
  },
};
