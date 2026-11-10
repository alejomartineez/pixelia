# Pixelia · Glosario de traducción (paso 4b-0)

Nombres propios y términos del juego con su forma **fija** en cada idioma. Quien traduce en el 4b usa estas formas y no
otras; si una no funciona en contexto, se cambia **acá primero** y después en todos los idiomas.

- **Modo:** `T` se traduce · `X` se transcribe (otro alfabeto, mismo sonido) · `=` queda igual.
- **Mayúsculas:** los sistemas y lugares van con mayúscula inicial donde el idioma lo permite (en, de, fr, pt-BR, ru en
  títulos y menús; dentro de una frase, en inglés y francés van con mayúscula solo los nombres propios y los sistemas:
  "your Logbook", "la Faille"). En alemán todo sustantivo ya va con mayúscula.
- **Artículo:** cuando el término lleva artículo en es ("el Quiebre"), se indica el que lleva en cada idioma.
- **CJK:** las formas japonesas, chinas y coreanas son las que van en la interfaz; sin espacios agregados alrededor.
- **Prueba:** `tools/test-i18n.mjs` (sección "Glosario") lee las tablas de este archivo y revisa que cada clave de `es.js`
  que usa un término lleve en `en.js` y `ja.js` la forma fijada. Las filas se leen por la primera columna en negrita:
  no cambies el orden de las columnas.
- Revisado a mano contra marcas conocidas y contra sentidos feos o ambiguos en cada idioma; lo que salió está en las
  notas de cada sección.

## 1. Mundo e historia

| es | cat | modo | en | zh-CN | ru | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|
| **Quiebre** | hecho | T | Fracture | 大崩裂 | Раскол | Ruptura | Bruch | Fracture | 大崩落 | 대붕괴 |
| **Grieta** | sistema | T | Rift | 裂隙 | Разлом | Fenda | Riss | Faille | 裂け目 | 균열 |
| **Grieta profunda** | modo | T | Deep Rift | 深层裂隙 | Глубокий разлом | Fenda Profunda | Tiefer Riss | Faille profonde | 深き裂け目 | 깊은 균열 |
| **Veta** | concepto | T | Vein | 矿脉 | Жила | Filão | Ader | Veine | 鉱脈 | 광맥 |
| **Núcleo de Raíz** | objeto | T | Root Core | 根之核 | Ядро Корня | Núcleo de Raiz | Wurzelkern | Noyau de Racine | 根の核 | 뿌리의 핵 |
| **Bajo Mundo** | lugar | T | Low World | 下界 | Нижний мир | Mundo de Baixo | Niederwelt | Bas-Monde | 下界 | 하계 |
| **islas flotantes** | lugar | T | floating islands | 浮空群岛 | парящие острова | ilhas flutuantes | schwebende Inseln | îles flottantes | 浮島 | 부유섬 |
| **Casas** | facción | T | Houses | 世家 | Дома | Casas | Häuser | Maisons | 名家 | 가문 |
| **Cofradía de la Veta** | facción | T | Syndicate of the Vein | 矿脉会 | Братство Жилы | Confraria do Filão | Bruderschaft der Ader | Confrérie de la Veine | 鉱脈結社 | 광맥 결사 |
| **Vaciados** | criaturas | T | Emptied | 空心人 | Опустошённые | Esvaziados | Ausgehöhlte | Évidés | 虚ろ者 | 비워진 자 |
| **Piratas del cielo** | facción | T | sky pirates | 空贼 | небесные пираты | piratas do céu | Himmelspiraten | pirates du ciel | 空賊 | 하늘 해적 |
| **reinos** | facción | T | kingdoms | 王国 | королевства | reinos | Königreiche | royaumes | 王国 | 왕국 |

Artículos: el Quiebre → the Fracture · der Bruch · la Fracture · a Ruptura. La Grieta → the Rift · der Riss · la Faille
· a Fenda. La Veta → the Vein · die Ader · la Veine · o Filão. La Cofradía → the Syndicate · die Bruderschaft · la
Confrérie · a Confraria.

Notas:
- **Quiebre**: el día en que el continente se partió. No es una guerra ni una catástrofe natural: lo provocaron las
  Casas. Evitar "Sundering" (Warcraft) y "Shattering" (Warcraft, Cataclysm). En ru, "Раскол" también nombra el cisma de
  la iglesia rusa del siglo XVII: se entiende por contexto y suma la idea de división social, que viene bien. En de,
  "Bruch" solo puede leerse como "hernia" o "fracción"; con artículo y mayúscula ("der Bruch") en títulos se entiende.
- **Grieta** (Rift): la medida de cuánto se dañó la isla por exprimir los elementos (0 a 100). En inglés existe el MMO
  *RIFT* (Trion), pero es una palabra común y no se usa como nombre propio suelto: va con artículo ("the Rift"). En ja
  ya está fijado 裂け目; en zh, 裂隙 en vez de 裂缝 (que suena a rajadura de pared).
- **Veta**: la corriente de elemento que corre por dentro de la tierra. En ru, "жила" coloquial también es "tacaño"; en
  el contexto de minería no se lee así, y el eco con la avaricia de las Casas no molesta. En pt-BR se descarta "veio"
  (también es "vino", del verbo vir): va **Filão**. En fr, "veine" también es "suerte" ("avoir de la veine"): no choca.
- **Bajo Mundo**: lo que no subió. En en no va "Underworld" (suena a infierno griego) ni en de "Unterwelt" por lo mismo.
- **Cofradía de la Veta**: una mafia con aire de hermandad vieja. En en se evita "Brotherhood" (Fallout, Assassin's
  Creed) y queda "Syndicate", que da el lado mafioso.
- **Vaciados**: gente a la que la veta le comió algo por dentro. En en se evita "Hollow/Hollowed" (Dark Souls); en ja,
  亡者 (Dark Souls ja), por eso 虚ろ者.

## 2. Elementos

| es | cat | modo | en | zh-CN | ru | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|
| **Raíz** | elemento | T | Root | 根 | Корень | Raiz | Wurzel | Racine | 根 | 뿌리 |
| **Marea** | elemento | T | Tide | 潮 | Прилив | Maré | Gezeit | Marée | 潮 | 조수 |
| **Brasa** | elemento | T | Ember | 余烬 | Жар | Brasa | Glut | Braise | 熾火 | 불씨 |
| **Céfiro** | elemento | T | Zephyr | 西风 | Зефир | Zéfiro | Zephyr | Zéphyr | 西風 | 서풍 |

Notas: los cuatro son **tierra, agua, fuego y aire**, pero nunca se los llama así en el juego. En ru, "Зефир" también es
un dulce (merengue): en contexto de elementos se entiende y es la palabra poética del viento; no cambiar. En ko, 불씨
(brasa que queda encendida) en vez de 잉걸, que es poco usado. Los adjetivos ("de Raíz", "fragmento de Brasa") siguen la
forma de cada idioma: "Root work", "Wurzelarbeit", "œuvre de Racine", 根の工事.

## 3. Personajes y pueblos

| es | cat | modo | en | zh-CN | ru | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|
| **Vera** | personaje | X | Vera | 薇拉 | Вера | Vera | Vera | Vera | ヴェラ | 베라 |
| **Tadeo Ibarra** | personaje | X | Tadeo Ibarra | 塔德奥·伊瓦拉 | Тадео Ибарра | Tadeo Ibarra | Tadeo Ibarra | Tadeo Ibarra | タデオ・イバラ | 타데오 이바라 |
| **Brígida** | personaje | X | Brígida | 布丽希达 | Бригида | Brígida | Brígida | Brígida | ブリヒダ | 브리히다 |
| **Nahuel** | personaje | X | Nahuel | 纳韦尔 | Науэль | Nahuel | Nahuel | Nahuel | ナウエル | 나우엘 |
| **Olga** | personaje | X | Olga | 奥尔加 | Ольга | Olga | Olga | Olga | オルガ | 올가 |
| **Ramiro Ochoa** | personaje | X | Ramiro Ochoa | 拉米罗·奥乔亚 | Рамиро Очоа | Ramiro Ochoa | Ramiro Ochoa | Ramiro Ochoa | ラミロ・オチョア | 라미로 오초아 |
| **Humanos** | pueblo | T | Humans | 人类 | Люди | Humanos | Menschen | Humains | 人間 | 인간 |
| **Enanos de la Veta** | pueblo | T | Vein Dwarves | 矿脉矮人 | Гномы Жилы | Anões do Filão | Aderzwerge | Nains de la Veine | 鉱脈のドワーフ | 광맥 드워프 |
| **Anuros del Bañado** | pueblo | T | Marsh Anurans | 沼泽蛙人 | Ануры Топей | Anuros do Banhado | Sumpfanuren | Anoures du Marais | 湿原の蛙人 | 습지 개구리족 |
| **Gente-zorro del Céfiro** | pueblo | T | Zephyr Foxfolk | 西风狐族 | Лисий народ Зефира | Povo-raposa do Zéfiro | Fuchsvolk des Zephyrs | Peuple-renard du Zéphyr | 西風の狐人 | 서풍 여우족 |
| **Orcos de la Brasa** | pueblo | T | Ember Orcs | 余烬兽人 | Орки Жара | Orcs da Brasa | Glut-Orks | Orcs de la Braise | 熾火のオーク | 불씨 오크 |
| **cartógrafa** | rol | T | cartographer | 制图师 | картограф | cartógrafa | Kartografin | cartographe | 地図職人 | 지도 제작자 |
| **intendente** | rol | T | mayor | 镇长 | градоначальник | intendente | Bürgermeister | maire | 町長 | 시장 |
| **narrador** | rol | T | narrator | 旁白 | рассказчик | narrador | Erzähler | narrateur | 語り手 | 내레이터 |

Notas:
- Los nombres de personas **no se traducen**: en alfabeto latino se dejan con tilde (Brígida); en ru, zh, ja y ko se
  transcriben por sonido rioplatense (la "g" de Brígida suena como "j": ブリヒダ, Бригида se acepta por costumbre rusa).
- Vera habla en registro neutro-cercano en todos los idiomas (ver cada `tono-<idioma>.md`).
- Los nombres que pone quien juega (ciudad, reclutas renombrados) y los de contactos **nunca** se traducen.
- **Anuros**: gente-rana. En ja y zh se aclara con 蛙 porque "anuro" no se entiende; en en y fr "Anurans/Anoures" es
  raro a propósito, como en español.
- **Orcos**: palabra genérica de fantasía, sin marca.
- **intendente** en es es el jefe del municipio; en pt-BR se deja (es la palabra histórica regional también allá).

## 4. Lugares del Acto 1

| es | cat | modo | en | zh-CN | ru | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|
| **Bosque del Arroyo** | isla | T | Brook Forest | 溪流森林 | Лес у Ручья | Bosque do Riacho | Bachwald | Forêt du Ruisseau | 小川の森 | 시냇물 숲 |
| **Sierras Bajas** | isla | T | Low Ridges | 低岭 | Низкие Кряжи | Serras Baixas | Niedere Kämme | Basses Sierras | 低き山並み | 낮은 산맥 |
| **Bañado de los Juncos** | isla | T | Reed Marsh | 芦苇沼泽 | Тростниковые Топи | Banhado dos Juncos | Schilfsumpf | Marais des Joncs | 葦の湿原 | 갈대 습지 |
| **Cerro del Hierro** | isla | T | Iron Hill | 铁丘 | Железный Холм | Morro do Ferro | Eisenhügel | Colline de Fer | 鉄の丘 | 철의 언덕 |
| **Costa de los Faros** | isla | T | Lighthouse Coast | 灯塔海岸 | Берег Маяков | Costa dos Faróis | Leuchtturmküste | Côte des Phares | 灯台の海岸 | 등대 해안 |
| **la poza honda** | lugar | T | the deep pool | 深潭 | глубокий омут | o poço fundo | der tiefe Tümpel | la fosse profonde | 深い淵 | 깊은 웅덩이 |
| **la mina sellada** | lugar | T | the sealed mine | 封闭的矿井 | запечатанная шахта | a mina selada | die versiegelte Mine | la mine scellée | 封じられた鉱山 | 봉인된 광산 |
| **el faro viejo** | lugar | T | the old lighthouse | 旧灯塔 | старый маяк | o farol velho | der alte Leuchtturm | le vieux phare | 古い灯台 | 낡은 등대 |

Notas: en ja, 小川 es "arroyo" (no diminutivo en sentido cozy: es la palabra normal). Las islas cortas ("el Bañado",
"el Cerro") usan la primera palabra de la forma larga: the Marsh, der Sumpf, le Marais, 湿原, 습지.

## 5. Sistemas

| es | cat | modo | en | zh-CN | ru | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|
| **Travesía** | sistema | T | Voyage | 远航 | Плавание | Travessia | Überfahrt | Traversée | 航海 | 항해 |
| **Zarpar** | botón | T | Set Sail | 启航 | Отплыть | Zarpar | Ablegen | Appareiller | 出航 | 출항 |
| **Marea del Quiebre** | sistema | T | Fracture Tide | 崩裂之潮 | Прилив Раскола | Maré da Ruptura | Flut des Bruchs | Marée de la Fracture | 大崩落の潮 | 대붕괴의 조류 |
| **Expedición** | sistema | T | Expedition | 远征 | Экспедиция | Expedição | Expedition | Expédition | 遠征 | 원정 |
| **Encanto** | recurso | T | Charm | 魅力 | Очарование | Encanto | Charme | Charme | 魅力 | 매력 |
| **Rango** | progreso | T | Rank | 位阶 | Ранг | Grau | Rang | Rang | ランク | 등급 |
| **Nivel** | progreso | T | Level | 等级 | Уровень | Nível | Stufe | Niveau | レベル | 레벨 |
| **Bitácora** | panel | T | Logbook | 航海日志 | Судовой журнал | Diário de Bordo | Logbuch | Journal de bord | 航海日誌 | 항해 일지 |
| **Hallazgos** | colección | T | Finds | 发现物 | Находки | Achados | Fundstücke | Trouvailles | 発見物 | 발견물 |
| **Cuartel** | edificio | T | Barracks | 营房 | Казарма | Quartel | Kaserne | Caserne | 兵舎 | 병영 |
| **Bomberos** | edificio | T | Fire Station | 消防站 | Пожарная часть | Bombeiros | Feuerwache | Caserne des pompiers | 消防署 | 소방서 |
| **Escuadra** | sistema | T | Squad | 小队 | Отряд | Esquadra | Trupp | Escouade | 小隊 | 분대 |
| **Recluta** | persona | T | Recruit | 新兵 | Новобранец | Recruta | Rekrut | Recrue | 隊員 | 대원 |
| **Encargos** | sistema | T | Errands | 委托 | Поручения | Tarefas | Aufträge | Commissions | 依頼 | 의뢰 |
| **Contratos** | sistema | T | Contracts | 契约 | Контракты | Contratos | Verträge | Contrats | 契約 | 계약 |
| **Misiones** | sistema | T | Quests | 任务 | Задания | Missões | Aufgaben | Quêtes | ミッション | 임무 |
| **Arsenal** | panel | T | Arsenal | 军械库 | Арсенал | Arsenal | Arsenal | Arsenal | 武器庫 | 무기고 |
| **Maestría** | progreso | T | Mastery | 精通 | Мастерство | Maestria | Meisterschaft | Maîtrise | 熟練 | 숙련 |
| **Fuerza** | progreso | T | Power | 战力 | Мощь | Poder | Kampfkraft | Puissance | 戦力 | 전투력 |
| **Talentos** | progreso | T | Talents | 天赋 | Таланты | Talentos | Talente | Talents | タレント | 재능 |
| **Paragon** | progreso | T | Paragon | 巅峰 | Парагон | Paragon | Paragon | Parangon | パラゴン | 파라곤 |
| **Vínculo** | progreso | T | Bond | 羁绊 | Связь | Vínculo | Bindung | Lien | 絆 | 유대 |
| **Taller** | edificio | T | Workshop | 工坊 | Мастерская | Oficina | Werkstatt | Atelier | 工房 | 공방 |
| **provisiones** | recurso | T | supplies | 补给 | припасы | provisões | Vorräte | provisions | 物資 | 보급품 |
| **Esquife** | objeto | T | Skiff | 小艇 | Ялик | Esquife | Skiff | Esquif | 小舟 | 조각배 |
| **Muelle** | edificio | T | Dock | 码头 | Пристань | Cais | Anleger | Quai | 桟橋 | 부두 |
| **Amenazas** | sistema | T | Threats | 威胁 | Угрозы | Ameaças | Bedrohungen | Menaces | 脅威 | 위협 |
| **Temporada** | sistema | T | Season | 赛季 | Сезон | Temporada | Saison | Saison | シーズン | 시즌 |
| **Época** | progreso | T | Era | 时代 | Эпоха | Era | Zeitalter | Époque | 時代 | 시대 |
| **Contactos** | online | T | Contacts | 联系人 | Контакты | Contatos | Kontakte | Contacts | 連絡先 | 연락처 |
| **Desarmar** | acción | T | Scrap | 拆解 | Разобрать | Desmontar | Zerlegen | Démonter | 分解 | 분해 |
| **Rasgo** | objeto | T | Trait | 特性 | Черта | Traço | Merkmal | Trait | 特性 | 특성 |

Notas:
- **Travesía**: salir del puerto en el esquife a una isla, recorrer sus nodos y volver. En ja va 航海 (combina con
  航海日誌); hoy hay textos del 2a con 旅 en prosa ("旅の間"), que se cambian en el 4b.
- **Marea del Quiebre**: la dificultad opcional (I a X) de una isla despejada. Repite a propósito la palabra del
  elemento **Marea**: se traduce igual en los dos ("Tide", "Marée", 潮). Los números van en romanos en todos los idiomas.
- **Encanto**: puntaje de lo lindo que está la ciudad; no es magia. En ru, "Очарование" (no "Шарм", que suena a
  perfume).
- **Rango** es de la **ciudad** (Aldea → Capital); **Nivel** es de quien lidera (1 a 50). No mezclar: en zh 位阶 /
  等级, en ko 등급 / 레벨, en de Rang / Stufe. En `talents.*`, "por rango" significa "por punto del talento" y se
  traduce "per rank / ランクごと" (no es el rango de la ciudad).
- **Bitácora**: el panel con Diario, Progreso, Logros y Manual. En ja ya fijado 航海日誌.
- **Hallazgos**: cosas que se encuentran explorando (láminas). No "coleccionables" ni "cartas". En ja ya fijado 発見物.
- **Encargos**: misiones por tiempo de los reclutas que no salen. En fr, "Commissions" puede leerse como "mandados"
  (también "hacer pis", en lenguaje infantil): en botón va solo, sin artículo, y se entiende. En fr no va "Missions"
  porque choca con Misiones.
- **Fuerza** (power level): número que suma Nivel, armas, herramientas y escuadra. Ojo: "+{n} de fuerza" de las
  amenazas es **otra** cosa (strength / 強さ), y no lleva la forma fija. En ru "Мощь" para no chocar con "сила", que va
  en las amenazas.
- **Maestría**: en ja la base es 熟練; 熟練度 cuando se habla del valor ("熟練度+25%"). Las dos pasan la prueba.
- **Taller**: en pt-BR "Oficina" (no "Ateliê", que es de arte); en fr "Atelier".
- **Arsenal**: palabra común en todos los idiomas pese al club de fútbol; no se usa como nombre suelto en marketing.

## 6. Rarezas

| es | cat | modo | en | zh-CN | ru | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|
| **Común** | rareza | T | Common | 普通 | Обычное | Comum | Gewöhnlich | Commun | コモン | 일반 |
| **Poco común** | rareza | T | Uncommon | 优秀 | Необычное | Incomum | Ungewöhnlich | Peu commun | アンコモン | 고급 |
| **Rara** | rareza | T | Rare | 稀有 | Редкое | Rara | Selten | Rare | レア | 희귀 |
| **Épica** | rareza | T | Epic | 史诗 | Эпическое | Épica | Episch | Épique | エピック | 영웅 |
| **Reliquia** | rareza | T | Relic | 遗物 | Реликвия | Relíquia | Relikt | Relique | レリック | 유물 |

Notas: las rarezas concuerdan con el arma en los idiomas con género (`arsenal.adj.f.*` / `arsenal.adj.m.*`): en ru va el
neutro de "оружие" en la etiqueta suelta y se concuerda en la frase; en de, fr y pt-BR, igual. Colores fijos: gris,
verde, azul, violeta, ámbar (no cambian por idioma). En ja, la etiqueta es レリック; el adjetivo actual "いにしえの"
(`arsenal.adj.*.reliquia`) es una excepción conocida que el 4b decide si se iguala.

## 7. Épocas y rangos de la ciudad

| es | cat | modo | en | zh-CN | ru | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|
| **Madera** | época | T | Wood | 木 | Дерево | Madeira | Holz | Bois | 木 | 나무 |
| **Piedra** | época | T | Stone | 石 | Камень | Pedra | Stein | Pierre | 石 | 돌 |
| **Ladrillo** | época | T | Brick | 砖 | Кирпич | Tijolo | Ziegel | Brique | 煉瓦 | 벽돌 |
| **Hierro** | época | T | Iron | 铁 | Железо | Ferro | Eisen | Fer | 鉄 | 철 |
| **Vidrio y acero** | época | T | Glass and Steel | 玻璃与钢 | Стекло и сталь | Vidro e Aço | Glas und Stahl | Verre et acier | ガラスと鋼 | 유리와 강철 |
| **Aldea** | rango | T | Hamlet | 聚落 | Хутор | Povoado | Weiler | Hameau | 集落 | 부락 |
| **Caserío** | rango | T | Settlement | 村落 | Селение | Arraial | Siedlung | Lieu-dit | 村落 | 촌락 |
| **Pueblo** | rango | T | Village | 村庄 | Деревня | Aldeia | Dorf | Village | 村 | 마을 |
| **Villa** | rango | T | Town | 镇 | Посад | Vila | Flecken | Bourg | 町 | 읍 |
| **Ciudad** | rango | T | City | 城市 | Город | Cidade | Stadt | Ville | 都市 | 도시 |
| **Gran Ciudad** | rango | T | Great City | 大城市 | Большой город | Grande Cidade | Großstadt | Grande ville | 大都市 | 대도시 |
| **Metrópolis** | rango | T | Metropolis | 都会 | Метрополия | Metrópole | Metropole | Métropole | メトロポリス | 메트로폴리스 |
| **Capital** | rango | T | Capital | 首都 | Столица | Capital | Hauptstadt | Capitale | 首都 | 수도 |

Notas: las épocas se nombran por el material ("época de Madera" → "Wood era", "Holz-Zeitalter", "époque du Bois",
"木の時代"). Rangos: sin diminutivos en ningún idioma (en ru no "Городок", en pt-BR no "Vilarejo"). En ja, "町" también
se usa para "tu ciudad" en general (町のランク): se deja así, y el rango 4 se lee por contexto.

## 8. Clases y ramas de talento

| es | cat | modo | en | zh-CN | ru | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|
| **Cazador** | clase | T | Hunter | 猎人 | Охотник | Caçador | Jäger | Chasseur | 狩人 | 사냥꾼 |
| **Forjador** | clase | T | Smith | 锻造师 | Кузнец | Ferreiro | Schmied | Forgeron | 鍛冶師 | 대장장이 |
| **Curandero** | clase | T | Healer | 医者 | Целитель | Curandeiro | Heiler | Guérisseur | 癒し手 | 치유사 |
| **Saqueador** | clase | T | Raider | 掠夺者 | Налётчик | Saqueador | Plünderer | Pillard | 略奪者 | 약탈자 |
| **Monje** | clase | T | Monk | 僧侣 | Монах | Monge | Mönch | Moine | 僧 | 수도승 |
| **Guerrero** | clase | T | Warrior | 战士 | Воин | Guerreiro | Krieger | Guerrier | 戦士 | 전사 |
| **Mando** | rama | T | Command | 统御 | Командование | Comando | Führung | Commandement | 指揮 | 지휘 |
| **Supervivencia** | rama | T | Survival | 生存 | Выживание | Sobrevivência | Überleben | Survie | 生存 | 생존 |
| **Oficio** | rama | T | Craft | 技艺 | Ремесло | Ofício | Handwerk | Métier | 職人 | 기술 |

Notas: en en no va "Forger" (también es "falsificador"): **Smith**. Las clases van en la forma que el idioma usa como
etiqueta de oficio; en ru, de, fr y pt-BR es la masculina genérica, igual que en es. Si en el 4b la clase pasa a
concordar con el recluta, se suman claves `.f`/`.m` como en las rarezas.

## 9. Marca y nombres que no se tocan

| es | cat | modo | en | zh-CN | ru | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|
| **Pixelia** | marca | = | Pixelia | Pixelia | Pixelia | Pixelia | Pixelia | Pixelia | Pixelia | Pixelia |
| **Dezings** | marca | = | Dezings | Dezings | Dezings | Dezings | Dezings | Dezings | Dezings | Dezings |

Notas: el nombre del juego queda en latín en todos los idiomas (logo, tienda, instalador). En la ficha de la tienda en
ja, zh y ko puede sumarse la lectura entre paréntesis la primera vez: ピクセリア, 像素利亚 (no oficial), 픽셀리아.

## 10. Frases fijas

| es | cat | modo | en | zh-CN | ru | pt-BR | de | fr | ja | ko |
|---|---|---|---|---|---|---|---|---|---|---|
| **Mientras no estabas** | frase | T | While you were away | 你不在的时候 | Пока тебя не было | Enquanto você estava fora | Während du weg warst | Pendant ton absence | 留守の間に | 자리를 비운 동안 |
| **Repetir travesía** | botón | T | Sail Again | 再次远航 | Плыть снова | Repetir travessia | Erneut ablegen | Repartir | もう一度航海 | 다시 항해 |
| **Resolver rápido** | botón | T | Quick Resolve | 快速结算 | Быстрый исход | Resolver rápido | Schnell auflösen | Résolution rapide | 即時決着 | 빠른 결판 |

Notas: "Mientras no estabas…" es el resumen al volver: **sin culpa** ("We missed you!" nunca). Los puntos suspensivos se
escriben con el carácter del idioma (… en latín y ru; …… en zh; … en ja y ko).
