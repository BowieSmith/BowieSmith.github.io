// Minds and Machines: an intertwined timeline of cognitive science and AI.
// Events are laid out one per row on a two-column grid (mind | machine),
// with "both" events sitting on the spine. Threads are drawn as SVG paths
// computed from the cards' real positions, so they survive any reflow.
(function () {
    'use strict';

    var $ = function (id) { return document.getElementById(id); };
    var SVG_NS = 'http://www.w3.org/2000/svg';

    // ---------------------------------------------------------------
    // Threads: single ideas followed across both strands.
    // Colors are the validated categorical palette, in its fixed order;
    // the ninth thread (dissent) takes the neutral slot.
    // ---------------------------------------------------------------

    var THREADS = [
        { id: 'language', name: 'Language', color: '#2a78d6',
          desc: 'Grammar, prediction, and meaning-from-use: the oldest argument in cognitive science, rerun at scale.' },
        { id: 'reward', name: 'Reward', color: '#eb6834',
          desc: 'Thorndike’s cats to dopamine neurons to Atari: a learning rule that began as animal psychology and was found in the midbrain.' },
        { id: 'vision', name: 'Seeing', color: '#1baf7a',
          desc: 'Cat cortex to convolutional networks and back: the cleanest case of a brain inspiring a machine that then explained the brain.' },
        { id: 'uncertainty', name: 'Inference', color: '#eda100',
          desc: 'From Helmholtz’s unconscious inference to bounded rationality, Bayesian children, and predictive brains.' },
        { id: 'mirror', name: 'The mirror', color: '#e87ba4',
          desc: 'AI as a model of the mind for sixty years; then the mind sciences as a way to study AI.' },
        { id: 'body', name: 'Body & world', color: '#008300',
          desc: 'The dissenting tradition that says the mind is not a model in a head: embodied, situated, extended, alive.' },
        { id: 'symbols', name: 'Symbols & rules', color: '#4a3aa7',
          desc: 'Reasoning as reckoning: the classical program, its winters, and its return as “slow thinking.”' },
        { id: 'neurons', name: 'Neurons & learning', color: '#e34948',
          desc: 'From logic-gate neurons to a Nobel prize: the idea that simple units adjusting their connections could think.' },
        { id: 'limits', name: 'Dissent & limits', color: '#898781',
          desc: 'Descartes, Lovelace, Gödel, Dreyfus, Searle, parrots: every line drawn around what machines cannot do.' }
    ];

    var THREAD_BY_ID = {};
    THREADS.forEach(function (t) { THREAD_BY_ID[t.id] = t; });

    // ---------------------------------------------------------------
    // What the mind has been compared to
    // ---------------------------------------------------------------

    var METAPHORS = [
        { era: 'antiquity to the 1600s', text: 'Animal spirits flowing through hollow nerves; temperament as the balance of four humours. The mind as plumbing.' },
        { era: '1600s to 1700s', text: 'Descartes’s automata and La Mettrie’s man-machine: the body, and for some the mind, as gears and springs.' },
        { era: '1800s to 1930s', text: 'Nerves as wires, reflexes as circuits, the brain as a telephone exchange: Sherrington’s “enchanted loom.”' },
        { era: '1950s onward', text: 'Storage, retrieval, buffers, programs, capacity limits: the vocabulary of the cognitive revolution, taken from the machine that made it possible.' },
        { era: '1980s onward', text: 'Weights, activations, distributed representations, settling into attractors: the connectionist brain.' },
        { era: '2010s onward', text: 'A generative model minimizing prediction error, and most recently a language model. The newest machine, once again, is the mind.' }
    ];

    // ---------------------------------------------------------------
    // Events. side: 'cog' (the mind), 'ai' (the machine), 'both' (a knot).
    // Order is display order; ties within a year are deliberate.
    // ---------------------------------------------------------------

    var EVENTS = [
        { id: 'descartes', year: 1637, side: 'cog', threads: ['limits'],
          title: 'Descartes: the animal is a machine; the mind is not',
          text: 'In the Discourse on the Method Descartes grants that animals are automata but insists no machine could “use words or other signs” appropriately in every situation, or act from reason in all circumstances.',
          more: 'Those two tests, flexible language and general reason, are almost exactly the lines the field would spend four centuries trying to cross. He also fixed the dualism (thinking substance versus extended substance) that functionalism would later try to dissolve.' },

        { id: 'hobbes', year: 1651, side: 'ai', threads: ['symbols'],
          title: 'Hobbes: reasoning is reckoning',
          text: '“For REASON… is nothing but reckoning, that is adding and subtracting.” Thought as computation over signs, stated three centuries before there were computers.',
          more: 'The idea lay dormant until symbolic AI made it a research program. Haugeland later named the classical approach “good old-fashioned AI” and traced it straight back to Hobbes.' },

        { id: 'leibniz', year: 1685, label: 'c. 1685', side: 'ai', threads: ['symbols'],
          title: 'Leibniz: “let us calculate”',
          text: 'Leibniz imagines a calculus ratiocinator, a universal symbolic language in which disputes would be settled by computation, and builds a stepped reckoner that can multiply.',
          more: 'His binary arithmetic and his dream of mechanized reasoning are the earliest sketch of what Frege, Turing, and the Logic Theorist would make real.' },

        { id: 'lamettrie', year: 1747, side: 'cog', threads: ['body'],
          title: 'La Mettrie: Man a Machine',
          text: 'A physician argues that the soul is a function of the body and that humans differ from animals only in degree. Scandalous then; close to orthodox in cognitive neuroscience now.',
          more: 'The materialist bet, that mind is what a certain kind of body does, is the root both of neural-network AI and of the embodied tradition that would later oppose it.' },

        { id: 'lovelace', year: 1843, side: 'ai', threads: ['limits'],
          title: 'Lovelace’s objection',
          text: 'Annotating Babbage’s Analytical Engine, Ada Lovelace writes that it “has no pretensions whatever to originate anything. It can do whatever we know how to order it to perform.”',
          more: 'Turing would name this “Lady Lovelace’s Objection” in 1950 and answer it with learning machines, which are precisely machines that do things we did not order.' },

        { id: 'boole', year: 1854, side: 'ai', threads: ['symbols'],
          title: 'Boole: The Laws of Thought',
          text: 'Boole gives logic an algebra and titles the book as if it were psychology. The equations of true and false would become the equations of switching circuits (Shannon, 1937).',
          more: 'Boole believed he was describing how minds reason. His notation went on to describe how transistors switch. It is the first case of a theory of mind becoming a machine design.' },

        { id: 'helmholtz', year: 1867, side: 'cog', threads: ['uncertainty', 'vision'],
          title: 'Helmholtz: perception as unconscious inference',
          text: 'Perceiving is inferring: the brain concludes what is out there from ambiguous sensory evidence, without our awareness.',
          more: 'This is the seed of the Bayesian brain and of predictive processing a century and a half later, and, through the idea of “analysis by synthesis,” of generative models in machine learning.' },

        { id: 'y1879', year: 1879, side: 'both', threads: ['symbols'],
          title: 'Psychology gets a laboratory; logic gets a notation',
          text: 'Wundt opens the first experimental psychology laboratory in Leipzig. The same year Frege publishes the Begriffsschrift, the first fully formal system of logic.',
          more: 'Two disciplines that would meet in 1956 become modern in the same year: one by measuring the mind, the other by making reasoning mechanical enough to be checked without a mind.' },

        { id: 'james', year: 1890, side: 'cog', threads: [],
          title: 'James: the stream of thought',
          text: 'The Principles of Psychology. “Everyone knows what attention is.” James describes memory, habit, and attention with a vividness the field would spend a century trying to formalize.',
          more: 'His account of habit as worn neural pathways anticipates Hebb; his “specious present” anticipates working memory; and “attention” would travel, much altered, into the architecture of language models.' },

        { id: 'thorndike', year: 1911, side: 'cog', threads: ['reward'],
          title: 'Thorndike: the law of effect',
          text: 'Cats in puzzle boxes: responses followed by satisfaction are “stamped in,” those followed by discomfort are stamped out. Learning as trial, error, and reward.',
          more: 'Rescorla and Wagner would make it an equation in 1972; Sutton and Barto would make the equation an algorithm; Schultz would find the algorithm in dopamine neurons.' },

        { id: 'watson', year: 1913, side: 'cog', threads: ['reward', 'mirror'],
          title: 'Watson: psychology as the behaviorist views it',
          text: 'Consciousness, introspection, and “mind” are declared unscientific. Psychology becomes the study of stimulus and response.',
          more: 'For forty years the inner life is off limits. It takes a machine with an inner life, a program with states, to make it respectable again. And a century later, the machines themselves would be studied, at first, in exactly Watson’s way.' },

        { id: 'godel', year: 1931, side: 'ai', threads: ['limits', 'symbols'],
          title: 'Gödel: incompleteness',
          text: 'Any consistent formal system rich enough for arithmetic contains truths it cannot prove.',
          more: 'Lucas (1961) and Penrose (1989) would argue this shows minds outrun machines. Most logicians think the argument fails, but it set the tone for a whole genre: what computers can’t do.' },

        { id: 'turing36', year: 1936, side: 'ai', threads: ['symbols', 'mirror'],
          title: 'Turing: the universal machine, modeled on a clerk',
          text: '“On Computable Numbers” defines computation by imagining a human clerk following rules with pencil and paper, then shows that a single machine can imitate any such clerk.',
          more: 'Computation was born as a model of a person. The abstraction that would later be used to model minds was, first, an idealized mind at work. The mirror’s first reflection.' },

        { id: 'skinner', year: 1938, side: 'cog', threads: ['reward'],
          title: 'Skinner: operant conditioning',
          text: 'The Behavior of Organisms: schedules of reinforcement shape behavior with great precision, in pigeons and, Skinner believed, in people.',
          more: 'The operant chamber’s logic, variable rewards shaping behavior, would return decades later in reinforcement learning and, less happily, in the design of feeds and notifications.' },

        { id: 'mcp', year: 1943, side: 'both', threads: ['neurons', 'symbols'],
          title: 'McCulloch & Pitts: the neuron as a logic gate',
          text: 'A neurophysiologist and a young logician show that networks of idealized neurons can compute any logical function. Brain and computer are, for the first time, the same object described twice.',
          more: 'The paper shaped von Neumann’s design of the stored-program computer and founded the neural-network tradition. It is the first knot in the double helix.' },

        { id: 'wiener43', year: 1943, side: 'ai', threads: ['body'],
          title: 'Rosenblueth, Wiener & Bigelow: purpose as feedback',
          text: '“Behavior, Purpose and Teleology” argues that goal-directedness, a taboo word in mechanistic science, is just negative feedback.',
          more: 'Cybernetics offers the first vocabulary in which minds and machines can be described together: information, feedback, control.' },

        { id: 'merleauponty', year: 1945, side: 'cog', threads: ['body'],
          title: 'Merleau-Ponty: the body knows',
          text: 'Phenomenology of Perception: perception is not a picture in the head but the body’s grip on a situation; skills are lived, not represented.',
          more: 'Dreyfus would bring this book into the AI debate in the 1960s; the embodied and enactive movements of the 1990s built on it.' },

        { id: 'vonneumann', year: 1945, side: 'ai', threads: ['neurons'],
          title: 'von Neumann: the stored program, in the language of neurons',
          text: 'The First Draft of a Report on the EDVAC describes the architecture nearly every computer since has used, and describes it with “neurons” and “organs,” citing McCulloch and Pitts.',
          more: 'The first computer design was written in the language of the brain. Within fifteen years, the brain would be described in the language of this computer.' },

        { id: 'macy', year: 1946, label: '1946–53', side: 'both', threads: ['body'],
          title: 'The Macy Conferences',
          text: 'Wiener, von Neumann, McCulloch, Pitts, Shannon, Bateson, Mead, Ashby: mathematicians, engineers, anthropologists and neurologists meet ten times to build a common science of “circular causal systems.”',
          more: 'The first interdisciplinary room in which mind and machine were one topic. Cognitive science would rebuild that room in 1956, with symbols in place of feedback loops.' },

        { id: 'shannon', year: 1948, side: 'ai', threads: ['uncertainty', 'language'],
          title: 'Shannon: information becomes a quantity',
          text: '“A Mathematical Theory of Communication” defines information in bits, independent of meaning.',
          more: 'Psychology borrowed the unit at once: Miller’s 1956 paper measured memory span in bits, and Broadbent treated the mind as a limited-capacity channel. Shannon’s n-gram models of English text are also the direct ancestors of language models.' },

        { id: 'cyber48', year: 1948, side: 'ai', threads: ['body'],
          title: 'Cybernetics, and the first lifelike robots',
          text: 'Wiener publishes Cybernetics: “control and communication in the animal and the machine.” Grey Walter’s tortoises seek light and find their charger; Ashby’s Homeostat adapts to stay stable.',
          more: 'Lifelike behavior from a few vacuum tubes. Braitenberg’s Vehicles (1984) and Brooks’s insect robots (1991) are their descendants.' },

        { id: 'lashley', year: 1948, side: 'cog', threads: ['symbols', 'language'],
          title: 'Lashley: the problem of serial order in behavior',
          text: 'At the Hixon Symposium, Lashley argues that speech and skilled action cannot be chains of reflexes; they require hierarchical plans specified in advance. A neuropsychologist dismantles behaviorism from within.',
          more: 'Miller, Galanter and Pribram’s Plans (1960) and Chomsky’s generative grammar would supply the hierarchies Lashley demanded.' },

        { id: 'hebb', year: 1949, side: 'cog', threads: ['neurons'],
          title: 'Hebb: cells that fire together wire together',
          text: 'The Organization of Behavior proposes that learning is the strengthening of connections between co-active neurons, organized into “cell assemblies.”',
          more: 'Hebbian learning is the ancestor of every weight-update rule in a neural network, and of Hopfield’s 1982 memory.' },

        { id: 'turing50', year: 1950, side: 'ai', threads: ['limits', 'mirror'],
          title: 'Turing: “Can machines think?” becomes a game',
          text: '“Computing Machinery and Intelligence” replaces the question with the imitation game, answers nine objections (Lovelace’s among them), and proposes a “child machine” that learns.',
          more: 'The test made intelligence behavioral, exactly the move psychology was about to abandon. Seventy years later, systems that pass casual versions of it forced the argument to start over.' },

        { id: 'simon55', year: 1955, side: 'cog', threads: ['uncertainty', 'symbols'],
          title: 'Simon: bounded rationality',
          text: 'In “A Behavioral Model of Rational Choice,” Herbert Simon replaces the perfectly rational agent with one who “satisfices” using limited time, information, and computation.',
          more: 'Simon is the double agent of this whole story: a Nobel Prize in economics, a Turing Award in computing, and a founding hand in both cognitive psychology and AI.' },

        { id: 'birth', year: 1956, side: 'both', threads: ['symbols', 'language', 'mirror'],
          title: 'The year both fields were born',
          text: 'Summer: the Dartmouth workshop adopts McCarthy’s term “artificial intelligence,” and Newell and Simon demonstrate the Logic Theorist, a program that proves theorems. September 11: at an MIT symposium on information theory, Miller presents the magical number seven, Chomsky presents three models of grammar, and Newell and Simon present the Logic Theorist again.',
          more: 'Miller later wrote that he left “with a conviction, more intuitive than rational, that experimental psychology, theoretical linguistics, and the computer simulation of cognitive processes were all pieces from a larger whole.” The same program was shown at both meetings: as AI in June, as psychology in September. Bruner, Goodnow and Austin’s A Study of Thinking appears the same year.' },

        { id: 'chomsky57', year: 1957, side: 'cog', threads: ['language', 'symbols'],
          title: 'Chomsky: Syntactic Structures',
          text: 'Grammar as a formal generative system. The Chomsky hierarchy classifies grammars by the automata needed to recognize them: a theory of human language that is also a theory of machines.',
          more: 'In 1959 his review of Skinner’s Verbal Behavior argues that no stimulus–response account can explain language, and behaviorism’s hold on psychology breaks. The nativism Chomsky defended would become the target of the largest empiricist experiment ever run: language models.' },

        { id: 'perceptron', year: 1958, side: 'both', threads: ['neurons', 'mirror'],
          title: 'Rosenblatt’s perceptron, published in Psychological Review',
          text: 'A learning machine that adjusts its connection weights from examples. The paper calls it “a probabilistic model for information storage and organization in the brain,” and it appears in a psychology journal.',
          more: 'The perceptron was AI and psychology at once. The Navy funded it; the press promised a machine that would “walk, talk, see, write.” Minsky and Papert would prove its limits in 1969.' },

        { id: 'gps', year: 1958, side: 'both', threads: ['symbols', 'mirror'],
          title: 'Newell, Shaw & Simon: a theory of human problem solving, as a program',
          text: '“Elements of a Theory of Human Problem Solving,” also in Psychological Review, presents the General Problem Solver as an account of how people solve problems, tested against think-aloud protocols.',
          more: 'Means–ends analysis, subgoals, heuristics: the program was the theory. The same year McCarthy invents LISP, giving symbolic AI its native tongue.' },

        { id: 'broadbent', year: 1958, side: 'cog', threads: ['language', 'uncertainty'],
          title: 'Broadbent: the mind as a flowchart',
          text: 'Perception and Communication explains attention as a limited-capacity filter and draws the mind as boxes and arrows borrowed from communications engineering.',
          more: 'The box-and-arrow diagram became the native visual language of cognitive psychology for fifty years.' },

        { id: 'hubelwiesel', year: 1959, side: 'cog', threads: ['vision'],
          title: 'Hubel & Wiesel: what a visual neuron wants',
          text: 'Recording from cat cortex, they find cells tuned to edges at particular orientations, arranged in a hierarchy from simple to complex.',
          more: 'Fukushima’s Neocognitron (1980) copied that hierarchy; LeCun’s convolutional networks inherited it; in 2014 such networks were found to predict the responses of the very kind of neurons Hubel and Wiesel had started with.' },

        { id: 'plans60', year: 1960, side: 'cog', threads: ['symbols'],
          title: 'Miller, Galanter & Pribram: Plans and the Structure of Behavior',
          text: 'The reflex arc is replaced by the TOTE unit (Test, Operate, Test, Exit), a feedback loop borrowed from programming. Harvard’s Center for Cognitive Studies opens the same year.',
          more: 'A manifesto: the vocabulary of computing (plans, subroutines, hierarchies) is now the vocabulary of the mind.' },

        { id: 'putnam', year: 1960, side: 'cog', threads: ['symbols', 'limits'],
          title: 'Putnam: functionalism, or the mind as software',
          text: '“Minds and Machines” argues that mental states are functional states, related to the brain as a program is to hardware. The mind–body problem, Putnam suggests, is no deeper than the software–hardware relation.',
          more: 'Functionalism became the default philosophy of cognitive science and licensed the whole enterprise: if mind is a functional organization, it could in principle run on silicon. Putnam himself later renounced it.' },

        { id: 'licklider', year: 1960, side: 'ai', threads: ['body', 'mirror'],
          title: 'Licklider: man–computer symbiosis',
          text: 'A psychoacoustician turned computer visionary imagines humans and machines thinking together in “very close coupling,” each doing what it does best.',
          more: 'The extended-mind idea stated as an engineering goal, and funded: Licklider’s ARPA office seeded the AI laboratories at MIT, Stanford and Carnegie Mellon, and the network that became the internet.' },

        { id: 'dreyfus65', year: 1965, side: 'cog', threads: ['limits', 'body'],
          title: 'Dreyfus: “Alchemy and Artificial Intelligence”',
          text: 'A phenomenologist at RAND argues that intelligence is embodied, situated know-how, not rule-following, and that the AI program is like climbing a tree to reach the moon.',
          more: 'Ridiculed at the time (an MIT chess program beat him in 1967), his 1972 book What Computers Can’t Do looked prescient when rule-based systems hit the common-sense wall. His remedy, embodiment, was not the one that later worked, which was scale.' },

        { id: 'eliza', year: 1966, side: 'ai', threads: ['mirror', 'limits'],
          title: 'Weizenbaum: ELIZA',
          text: 'A few hundred lines of pattern matching play a Rogerian therapist. Weizenbaum’s secretary asks him to leave the room so she can talk to it privately.',
          more: 'Alarmed at how readily people attributed understanding, Weizenbaum wrote Computer Power and Human Reason (1976), arguing that some judgments should never be delegated to machines, whatever their competence.' },

        { id: 'neisser', year: 1967, side: 'cog', threads: ['symbols'],
          title: 'Neisser names the field',
          text: 'Cognitive Psychology organizes the new work under one title, in the language of information processing. Sternberg’s reaction-time method (1966) treats mental steps as serial computation stages; Atkinson and Shiffrin (1968) give memory a computer’s architecture.',
          more: 'Sensory register, short-term store, long-term store: the mind acquires a memory hierarchy. Nine years later, in Cognition and Reality, Neisser warns that the field has lost touch with how people actually perceive in the world.' },

        { id: 'semantic', year: 1968, side: 'both', threads: ['symbols', 'language'],
          title: 'Semantic networks: a data structure that is also a theory of memory',
          text: 'Quillian represents concepts as nodes and links; Collins and Quillian (1969) show that people’s reaction times track the distance between nodes. An AI representation, validated as psychology.',
          more: 'Minsky’s frames (1974) and Schank’s scripts (1977) repeat the pattern: knowledge representations for programs, tested as theories of human understanding.' },

        { id: 'perceptrons69', year: 1969, side: 'ai', threads: ['neurons', 'limits'],
          title: 'Minsky & Papert: Perceptrons',
          text: 'A rigorous proof of what single-layer perceptrons cannot compute (parity, connectedness), read as a verdict on neural networks in general. Funding dries up for fifteen years.',
          more: 'The book’s real target was a theory of the mind: could intelligence be pattern association? The symbolic camp said no. The question came back in 1986.' },

        { id: 'rw72', year: 1972, side: 'cog', threads: ['reward'],
          title: 'Rescorla & Wagner: learning as surprise',
          text: 'Conditioning happens in proportion to prediction error: animals learn when the world differs from what they expected.',
          more: 'The equation is a temporal-difference rule waiting to be discovered. Sutton and Barto discovered it, and published in Psychological Review in 1981.' },

        { id: 'shrdlu', year: 1972, side: 'ai', threads: ['language', 'symbols'],
          title: 'Winograd’s SHRDLU; Newell & Simon’s Human Problem Solving',
          text: 'SHRDLU converses fluently about a world of blocks, the high-water mark of symbolic language understanding and, its author later concluded, a dead end. Newell and Simon’s 900-page Human Problem Solving lays out the symbol-processing theory of thought in full.',
          more: 'Winograd went on to co-write Understanding Computers and Cognition (1986), a Heideggerian critique of the very approach SHRDLU embodied.' },

        { id: 'lighthill', year: 1973, side: 'ai', threads: ['limits'],
          title: 'The Lighthill report and the first winter',
          text: 'A British review finds AI’s grand promises unmet and its combinatorial explosion unsolved; funding is cut in the UK, and American agencies soon follow.',
          more: 'Winters are not only about money. Each one marks a moment when a theory of the mind (here, search over symbols) hit the limits of what it could explain.' },

        { id: 'kt74', year: 1974, side: 'cog', threads: ['uncertainty', 'limits'],
          title: 'Kahneman & Tversky: heuristics and biases',
          text: 'Human judgment under uncertainty follows shortcuts (availability, representativeness, anchoring) that produce systematic errors. Bounded rationality, measured.',
          more: 'Prospect theory follows in 1979; Thinking, Fast and Slow (2011) gives AI its System 1 / System 2 vocabulary. Also 1974: Nagel asks what it is like to be a bat, and the question of experience refuses to be functionalized.' },

        { id: 'fodor75', year: 1975, side: 'cog', threads: ['symbols'],
          title: 'Fodor: the language of thought',
          text: 'Thinking is computation over sentence-like mental representations, a “mentalese” with its own syntax and semantics. In 1983 The Modularity of Mind adds that the mind is built of specialized input systems.',
          more: 'The clearest philosophical statement of classical cognitive science. Fodor also insisted, in the same breath, that the central systems of thought might be beyond computational explanation altogether.' },

        { id: 'pssh', year: 1976, side: 'both', threads: ['symbols'],
          title: 'Newell & Simon: the physical symbol system hypothesis',
          text: 'Their Turing Award lecture: “A physical symbol system has the necessary and sufficient means for general intelligent action.” A claim about machines and about brains at once, offered as an empirical hypothesis.',
          more: 'Also 1976: Weizenbaum’s Computer Power and Human Reason, and MYCIN diagnosing infections from hand-written rules, opening the expert-systems era.' },

        { id: 'cogsci77', year: 1977, side: 'cog', threads: ['mirror'],
          title: 'Cognitive science gets a journal and a hexagon',
          text: 'Cognitive Science begins publication. In 1978 a Sloan Foundation report draws the field as a hexagon (philosophy, psychology, linguistics, anthropology, neuroscience, AI) with lines between the corners. The Society first meets in 1979.',
          more: 'AI is one of the six corners. The founding assumption: building a mind and studying one are the same activity.' },

        { id: 'gibson', year: 1979, side: 'cog', threads: ['body', 'vision'],
          title: 'Gibson: affordances',
          text: 'The Ecological Approach to Visual Perception: we do not compute a model of the world from retinal pixels; we pick up information already present in structured light, and perceive what the environment affords.',
          more: 'Anti-computational and anti-representational, and later adopted by designers, roboticists and the enactivists. Also 1979: Hofstadter’s Gödel, Escher, Bach.' },

        { id: 'searle', year: 1980, side: 'cog', threads: ['limits', 'language'],
          title: 'Searle: the Chinese Room',
          text: 'A man who speaks no Chinese follows a rulebook to produce perfect Chinese replies. He understands nothing; therefore, Searle argues, neither does any program. Syntax is not sufficient for semantics.',
          more: 'Published with dozens of replies and never settled. The 2020s reran it under a new name: stochastic parrots.' },

        { id: 'neocognitron', year: 1980, side: 'ai', threads: ['vision', 'neurons'],
          title: 'Fukushima: the Neocognitron',
          text: 'A multilayer network of “S-cells” and “C-cells” modeled explicitly on Hubel and Wiesel’s simple and complex cells, recognizing patterns regardless of position.',
          more: 'The architecture of every convolutional network, taken from cat cortex.' },

        { id: 'embodied80', year: 1980, side: 'cog', threads: ['body'],
          title: 'Lakoff & Johnson; Maturana & Varela',
          text: 'Metaphors We Live By argues that abstract thought is structured by bodily metaphor. Autopoiesis and Cognition argues that cognition is what living, self-producing systems do.',
          more: 'Two roots of the embodied turn: meaning grows from the body, and mind begins with life. Dreyfus and Dreyfus’s five-stage model of skill acquisition appears the same year.' },

        { id: 'suttonbarto81', year: 1981, side: 'both', threads: ['reward', 'mirror'],
          title: 'Sutton & Barto: a learning theory for animals, in Psychological Review',
          text: '“Toward a Modern Theory of Adaptive Networks: Expectation and Prediction” reformulates classical conditioning as prediction learning, in the Rescorla–Wagner tradition, and as an algorithm for machines.',
          more: 'The roots of reinforcement learning are in animal psychology. The algorithm and the theory have the same paper for a birthplace.' },

        { id: 'marr', year: 1982, side: 'cog', threads: ['vision', 'neurons'],
          title: 'Marr: three levels',
          text: 'Vision, published after Marr’s death at 35, argues that any information-processing system must be understood at three levels: what problem it solves, what algorithm it uses, and how that is implemented.',
          more: 'Marr worked at the MIT AI Lab. His levels became the methodological charter of cognitive science and are still how the field asks whether an AI system “explains” a brain. Hopfield’s network of the same year shows memory as an energy landscape.' },

        { id: 'expert82', year: 1982, side: 'ai', threads: ['symbols'],
          title: 'The expert-systems boom',
          text: 'Japan announces the Fifth Generation project; DEC’s XCON saves millions configuring computers; Lisp-machine companies multiply. Knowledge engineering, interviewing experts and writing down their rules, becomes an industry.',
          more: 'It rested on a psychological bet: that expertise is explicit knowledge. Dreyfus, Polanyi (“we know more than we can tell”), and the experts themselves disagreed.' },

        { id: 'cyc84', year: 1984, side: 'ai', threads: ['symbols', 'mirror'],
          title: 'Cyc, and Braitenberg’s Vehicles',
          text: 'Lenat begins Cyc, a decades-long effort to hand-encode common sense in millions of assertions. Braitenberg’s Vehicles shows tiny synthetic creatures whose simple wiring produces behavior observers call fear, love, and logic.',
          more: 'Braitenberg’s “law of uphill analysis and downhill invention”: it is far easier to build a mind-like thing than to understand one by observation. The 2020s would prove him right. Dennett’s Elbow Room (1984) argues that free will survives a mechanistic self.' },

        { id: 'pdp', year: 1986, side: 'both', threads: ['neurons', 'language', 'symbols'],
          title: 'Parallel Distributed Processing',
          text: 'Rumelhart, McClelland, Hinton and colleagues publish the two PDP volumes and, in Nature, the backpropagation algorithm. Knowledge is not rules but weights; thinking is not symbol manipulation but settling.',
          more: 'The books are psychology: a network learns English past tenses, overgeneralizes like a child (“goed”), and recovers. Pinker and Prince reply; Fodor and Pylyshyn (1988) argue networks cannot explain the systematicity of thought; Smolensky (1988) proposes a subsymbolic level. The central debate of cognitive science is conducted in the vocabulary of two AI architectures.' },

        { id: 'suchman87', year: 1987, side: 'cog', threads: ['body', 'limits'],
          title: 'Situated action, and the second winter',
          text: 'Suchman’s Plans and Situated Actions, from ethnography at Xerox PARC, argues that plans are resources for action, not programs that produce it. Winograd and Flores make a Heideggerian case against representation. The Lisp-machine market collapses; expert systems prove brittle.',
          more: 'The critics’ point was not that machines cannot be intelligent, but that intelligence is not what the programs had assumed.' },

        { id: 'pearl', year: 1988, side: 'ai', threads: ['uncertainty'],
          title: 'Pearl: Bayesian networks',
          text: 'Probabilistic Reasoning in Intelligent Systems gives AI a calculus of uncertainty, directed graphs of causes with probabilities, in place of brittle rules.',
          more: 'Within fifteen years the same formalism was a theory of how children learn causal structure (Gopnik et al., 2004). Sutton’s temporal-difference paper appears the same year.' },

        { id: 'lecun89', year: 1989, side: 'ai', threads: ['vision', 'neurons'],
          title: 'LeCun: convolutional networks read zip codes',
          text: 'Backpropagation trained on a Neocognitron-style architecture reads handwritten digits for the U.S. Postal Service.',
          more: 'The Journal of Cognitive Neuroscience is founded the same year, and fMRI arrives in 1991–92. Brain imaging and learned vision begin the parallel careers that converge in 2014.' },

        { id: 'elman', year: 1990, side: 'cog', threads: ['language', 'neurons'],
          title: 'Elman: finding structure in time',
          text: 'A simple recurrent network, trained only to predict the next word, discovers word categories and grammatical structure without being told they exist. Published in Cognitive Science.',
          more: 'The direct ancestor of language models. Its argument, that prediction alone can induce structure, was a psychological claim about children long before it was an engineering fact. Harnad’s “symbol grounding problem,” the same year, asks how any such symbols could mean anything.' },

        { id: 'brooks91', year: 1991, side: 'both', threads: ['body'],
          title: 'Brooks: intelligence without representation; The Embodied Mind',
          text: 'Brooks’s insect robots have no world model, only layers of simple behaviors: “the world is its own best model.” Varela, Thompson and Rosch propose enaction, cognition as embodied action, drawing on Merleau-Ponty and Buddhist philosophy.',
          more: 'A roboticist and three cognitive scientists reach the same conclusion from opposite ends: the mind is not a model in a head.' },

        { id: 'dynamics94', year: 1994, side: 'cog', threads: ['body', 'reward'],
          title: 'Dynamical systems, and hippocampal replay',
          text: 'Thelen and Smith describe infant development as a dynamical system rather than a program. Wilson and McNaughton find that sleeping rats replay the day’s place-cell sequences in the hippocampus.',
          more: 'Van Gelder (1995) asks “what might cognition be, if not computation?” Twenty-one years later, DeepMind’s Atari player borrowed hippocampal replay to stabilize its learning.' },

        { id: 'hutchins95', year: 1995, side: 'cog', threads: ['body', 'limits'],
          title: 'Hutchins: Cognition in the Wild',
          text: 'Navigating a Navy ship is cognition done by a team, its tools, and its charts; no individual head holds the computation. Chalmers names the “hard problem” of consciousness the same year.',
          more: 'Clark and Chalmers’s “The Extended Mind” (1998) makes the philosophical case: Otto’s notebook is part of Otto’s memory.' },

        { id: 'y1997', year: 1997, side: 'both', threads: ['reward', 'language', 'limits'],
          title: 'Deep Blue, dopamine, and meaning from co-occurrence',
          text: 'Deep Blue beats Kasparov by brute search, and chess quietly stops counting as intelligence. Schultz, Dayan and Montague show that dopamine neurons encode exactly the reward-prediction error of temporal-difference learning. Landauer and Dumais show, in Psychological Review, that statistics of word co-occurrence predict human vocabulary learning.',
          more: 'One loop closes (Thorndike to algorithm to neuron). One opens (distributional meaning to word2vec to language models). And the “AI effect,” whatever gets solved was never really intelligence, has its clearest demonstration. Moravec’s paradox (1988) had already noted that the hard things are easy and the easy things hard.' },

        { id: 'raoballard', year: 1999, side: 'cog', threads: ['uncertainty', 'vision'],
          title: 'Rao & Ballard: predictive coding',
          text: 'A model of visual cortex in which higher areas predict lower ones and only the prediction errors are passed upward, explaining puzzling neural responses as the signature of prediction.',
          more: 'Helmholtz’s unconscious inference becomes a circuit. Friston’s free-energy principle (2005–2010) and Clark’s “Whatever Next?” (2013) build the predictive brain on it.' },

        { id: 'tenenbaum', year: 2001, side: 'cog', threads: ['uncertainty'],
          title: 'Tenenbaum & Griffiths: the Bayesian mind',
          text: 'Human generalization, similarity, and concept learning explained as Bayesian inference over structured hypotheses. Gopnik and colleagues (2004) show that children reason like causal Bayes nets.',
          more: 'A formalism from AI (Pearl, 1988) becomes a theory of cognitive development. Metzinger’s Being No One (2003) argues, in the same years, that the self is a model the brain builds.' },

        { id: 'deepbelief', year: 2006, side: 'ai', threads: ['neurons'],
          title: 'Hinton: deep belief networks',
          text: 'Layer-by-layer pretraining makes deep networks trainable, and the phrase “deep learning” gathers a community.',
          more: 'Hinton, an experimental psychologist by training who did the PDP work alongside psychologists, has said his goal was always to understand the brain. Thompson’s Mind in Life (2007) restates the opposite bet: cognition begins with living.' },

        { id: 'imagenet', year: 2009, side: 'ai', threads: ['vision', 'language'],
          title: 'ImageNet, built on WordNet',
          text: 'Fei-Fei Li’s team labels fourteen million images across categories taken from WordNet, George Miller’s lexical database of English, begun in 1985 as a psycholinguistics project.',
          more: 'Li has described being motivated by developmental psychology’s estimate of the visual experience a child accumulates, and by Biederman’s count of roughly 30,000 object categories humans recognize. The dataset that started the deep-learning era was scaffolded by cognitive science.' },

        { id: 'alexnet', year: 2012, side: 'ai', threads: ['neurons', 'vision'],
          title: 'AlexNet',
          text: 'A convolutional network trained on GPUs halves the error rate on ImageNet. The connectionist program, dormant, ridiculed, and revived, becomes the dominant paradigm of AI within three years.',
          more: 'The architecture traces to Fukushima (1980) and Hubel and Wiesel (1959); the learning rule to Rumelhart, Hinton and Williams (1986); the data to Miller’s WordNet.' },

        { id: 'predictive13', year: 2013, side: 'both', threads: ['language', 'uncertainty'],
          title: 'Word2vec, and the predictive brain',
          text: 'Mikolov’s word2vec learns vector meanings from co-occurrence: king − man + woman ≈ queen. Clark’s “Whatever Next?” makes predictive processing the leading framework in cognitive science; Hohwy’s The Predictive Mind follows.',
          more: 'Both fields converge on one idea from opposite directions: to understand is to predict.' },

        { id: 'yamins14', year: 2014, side: 'both', threads: ['vision', 'mirror'],
          title: 'Yamins & DiCarlo: the network is the best model of the brain',
          text: 'Deep networks trained only to recognize objects predict the firing of neurons in monkey visual cortex better than any model built by neuroscientists.',
          more: 'The tool becomes the theory. Brain-Score (2018) makes it a leaderboard: AI models ranked by how well they explain brains. Bahdanau’s “attention” mechanism, borrowing psychology’s word, appears the same year.' },

        { id: 'dqn', year: 2015, side: 'ai', threads: ['reward'],
          title: 'DQN: an Atari player with a hippocampus',
          text: 'DeepMind’s network learns 49 Atari games from pixels using temporal-difference learning and “experience replay,” which the authors connect to hippocampal replay during sleep.',
          more: 'Thorndike’s law, Rescorla and Wagner’s equation, Sutton’s algorithm, Schultz’s dopamine, and Wilson and McNaughton’s rats, in one system. AlphaGo follows in 2016.' },

        { id: 'transformer17', year: 2017, side: 'both', threads: ['language', 'symbols', 'mirror'],
          title: 'Transformers, and a wish list from cognitive science',
          text: '“Attention Is All You Need” introduces the architecture behind every large language model. The same year, Lake, Ullman, Tenenbaum and Gershman publish “Building Machines That Learn and Think Like People,” listing what deep learning lacks: intuitive physics, intuitive psychology, compositionality, causal models, learning from few examples.',
          more: 'Hassabis and colleagues argue for “neuroscience-inspired AI.” Jonas and Kording ask whether a neuroscientist could understand a microprocessor, and find that the standard methods fail. Two moods in one year: an architecture that would soon exceed expectations, and a careful list of what it did not have, several items of which it acquired anyway, at scale.' },

        { id: 'bitter19', year: 2019, side: 'ai', threads: ['symbols', 'mirror', 'limits'],
          title: 'Sutton: the bitter lesson',
          text: 'Seventy years of AI show that general methods leveraging computation beat methods built on human knowledge of how we think: “building in how we think we think does not work in the long run.” Bengio, the same year, proposes System 2 deep learning, Kahneman’s slow thinking as a research agenda.',
          more: 'The bitter lesson is a verdict on one wing of cognitive science’s contribution to AI, the hand-coded theories, and arguably a vindication of the other: learn everything from experience.' },

        { id: 'gpt3', year: 2020, side: 'both', threads: ['language', 'limits', 'mirror', 'neurons'],
          title: 'GPT-3, circuits, and the octopus',
          text: 'A 175-billion-parameter next-word predictor writes fluent prose and does arithmetic it was never taught. Bender and Koller argue that a system trained on form alone cannot learn meaning (the octopus test); “stochastic parrots” follows in 2021. Olah and colleagues publish “Zoom In,” treating a network as an organism to be dissected into circuits.',
          more: 'Searle’s question returns; Harnad’s grounding problem returns; and the study of artificial networks begins to look like neuroscience. Lillicrap and colleagues review whether the brain could be doing backpropagation. Scaling laws (Kaplan et al.) make capability a function of compute.' },

        { id: 'schrimpf21', year: 2021, side: 'cog', threads: ['language', 'mirror'],
          title: 'Language models predict the language brain',
          text: 'Schrimpf and colleagues show that the better a model predicts the next word, the better its internal states predict fMRI and electrode recordings from the human language network. Goldstein and colleagues (2022) find that the brain, too, predicts upcoming words.',
          more: 'Elman’s 1990 claim, that prediction alone induces linguistic structure, is now the leading model of the language cortex.' },

        { id: 'chatgpt', year: 2022, side: 'ai', threads: ['mirror', 'language', 'limits'],
          title: 'ChatGPT',
          text: 'A conversational language model reaches a hundred million users in two months. For the first time the general public talks daily with a system that passes casual versions of the imitation game, and people disagree, exactly as Turing predicted, about what that means.',
          more: 'Weizenbaum’s secretary, at planetary scale.' },

        { id: 'reversal23', year: 2023, side: 'both', threads: ['mirror', 'language', 'limits'],
          title: 'The mirror turns',
          text: 'Binz and Schulz run classic cognitive psychology experiments on GPT-3 (“machine psychology”). Kosinski reports theory-of-mind performance in language models; Ullman shows it breaks under trivial perturbations. Chomsky calls ChatGPT “the false promise”; Piantadosi replies that language models refute Chomsky’s approach; Frank notes that children learn from a thousandth of the data.',
          more: 'For sixty years AI was a model of the mind. Now psychology’s methods are turned on AI, and the oldest debate in cognitive science, nativism versus empiricism, is run again with a new specimen. The BabyLM challenge asks models to learn from what a child hears.' },

        { id: 'y2024', year: 2024, side: 'both', threads: ['neurons', 'language', 'symbols', 'mirror'],
          title: 'A physics prize, and a separation of language from thought',
          text: 'Hopfield and Hinton receive the Nobel Prize in Physics for artificial neural networks: a biophysicist and a psychologist, honored by physicists, for a tool now used by everyone. Fedorenko, Piantadosi and Gibson argue in Nature that language is primarily a tool for communication rather than thought: the brain’s language network is distinct from its reasoning networks.',
          more: '“Reasoning models,” trained to think step by step before answering, revive the System 1 / System 2 program in machines. If language and thought are separable in brains, then fluent language in a machine is not, by itself, evidence of thought, nor evidence against it. The question has to be asked differently.' },

        { id: 'biology25', year: 2025, side: 'ai', threads: ['mirror', 'neurons'],
          title: '“On the Biology of a Large Language Model”',
          text: 'Interpretability researchers trace circuits through a production language model and describe what they find in the language of biology: features, pathways, dissection. The artifact is studied as an organism, because no one can read its design.',
          more: 'Braitenberg’s law, fulfilled. The synthetic method, understand by building, has produced something we built and now must study the way we study the brain.' }
    ];

    // ---------------------------------------------------------------
    // Small DOM helpers
    // ---------------------------------------------------------------

    function el(tag, cls, text) {
        var e = document.createElement(tag);
        if (cls) e.className = cls;
        if (text !== undefined) e.textContent = text;
        return e;
    }

    function sideLabel(side) {
        return side === 'cog' ? 'mind' : side === 'ai' ? 'machine' : 'both';
    }

    function threadsOf(ev) {
        return ev.threads.map(function (id) { return THREAD_BY_ID[id]; });
    }

    // ---------------------------------------------------------------
    // Metaphor strip
    // ---------------------------------------------------------------

    (function metaphors() {
        var box = $('metaphors'), desc = $('metaphorDesc');
        if (!box) return;
        var buttons = box.querySelectorAll('button');
        function show(i) {
            for (var k = 0; k < buttons.length; k++) buttons[k].classList.toggle('active', k === i);
            desc.textContent = METAPHORS[i].era + ': ' + METAPHORS[i].text;
        }
        for (var k = 0; k < buttons.length; k++) {
            (function (i) { buttons[i].addEventListener('click', function () { show(i); }); })(k);
        }
        show(3);
    })();

    // ---------------------------------------------------------------
    // Timeline: build the cards
    // ---------------------------------------------------------------

    var tl = $('tl'), svg = $('threadSvg');
    var cards = {};

    EVENTS.forEach(function (ev, i) {
        var art = el('article', 'ev side-' + ev.side);
        art.id = 'ev-' + ev.id;
        art.tabIndex = 0;
        art.setAttribute('role', 'button');
        art.setAttribute('aria-expanded', 'false');
        art.style.gridRow = String(i + 1);

        var head = el('div', 'ev-head');
        head.appendChild(el('div', 'ev-year', ev.label || String(ev.year)));
        head.appendChild(el('span', 'ev-tag', sideLabel(ev.side)));
        art.appendChild(head);
        art.appendChild(el('h3', 'ev-title', ev.title));
        art.appendChild(el('p', 'ev-text', ev.text));
        art.appendChild(el('p', 'ev-more', ev.more));

        if (ev.threads.length) {
            var chips = el('div', 'ev-chips');
            threadsOf(ev).forEach(function (t) {
                var c = el('span', 'chip', t.name);
                c.style.setProperty('--c', t.color);
                chips.appendChild(c);
            });
            art.appendChild(chips);
        }
        art.appendChild(el('div', 'ev-hint', 'tap for more'));

        art.addEventListener('click', function () { toggle(art); });
        art.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(art); }
        });
        art.addEventListener('mouseenter', function () { highlight(ev, true); });
        art.addEventListener('mouseleave', function () { highlight(ev, false); });
        art.addEventListener('focus', function () { highlight(ev, true); });
        art.addEventListener('blur', function () { highlight(ev, false); });

        tl.appendChild(art);
        cards[ev.id] = art;
    });

    function toggle(art) {
        var open = art.classList.toggle('open');
        art.setAttribute('aria-expanded', open ? 'true' : 'false');
        window.requestAnimationFrame(drawThreads);
    }

    function highlight(ev, on) {
        if (state) return;   // isolate mode already says what matters
        cards[ev.id].classList.toggle('hl', on);
        var paths = svg.querySelectorAll('path');
        for (var i = 0; i < paths.length; i++) {
            var p = paths[i];
            if (ev.threads.indexOf(p.getAttribute('data-thread')) >= 0) p.classList.toggle('hl', on);
        }
    }

    // ---------------------------------------------------------------
    // Threads as SVG paths, computed from the cards' real positions
    // ---------------------------------------------------------------

    function isNarrow() { return window.matchMedia('(max-width: 700px)').matches; }

    function fmt(n) { return Math.round(n * 10) / 10; }

    // Exit the card horizontally, run down a rail beside the spine, enter
    // the next card horizontally. Rails are offset per thread so they read
    // like parallel lines rather than one tangle.
    function pathD(ax, ay, bx, by, rx) {
        var dy = by - ay;
        if (Math.abs(dy) < 6) return 'M' + fmt(ax) + ',' + fmt(ay) + ' L' + fmt(bx) + ',' + fmt(by);
        var s = dy >= 0 ? 1 : -1;
        var d = Math.min(36, Math.abs(dy) / 2);
        var out = 'M' + fmt(ax) + ',' + fmt(ay) +
            ' C' + fmt(ax + (rx - ax) * 0.6) + ',' + fmt(ay) + ' ' + fmt(rx) + ',' + fmt(ay + d * 0.4 * s) +
            ' ' + fmt(rx) + ',' + fmt(ay + d * s);
        out += ' L' + fmt(rx) + ',' + fmt(by - d * s);
        out += ' C' + fmt(rx) + ',' + fmt(by - d * 0.4 * s) + ' ' + fmt(bx + (rx - bx) * 0.6) + ',' + fmt(by) +
            ' ' + fmt(bx) + ',' + fmt(by);
        return out;
    }

    function anchors(ev, origin, narrow) {
        var r = cards[ev.id].getBoundingClientRect();
        var top = r.top - origin.top, left = r.left - origin.left;
        var right = r.right - origin.left, bottom = r.bottom - origin.top;
        if (narrow) return { ix: left, iy: top + 20, ox: left, oy: top + 20 };
        if (ev.side === 'cog') return { ix: right, iy: top + 18, ox: right, oy: top + 18 };
        if (ev.side === 'ai') return { ix: left, iy: top + 18, ox: left, oy: top + 18 };
        var cx = (left + right) / 2;
        return { ix: cx, iy: top, ox: cx, oy: bottom };
    }

    var linkStats = { total: 0, crossing: 0 };

    function drawThreads() {
        var origin = tl.getBoundingClientRect();
        var W = tl.offsetWidth, H = tl.offsetHeight;
        var narrow = isNarrow();
        var spineX = narrow ? 22 : W / 2;
        var gap = narrow ? 3 : 5;

        svg.setAttribute('width', W);
        svg.setAttribute('height', H);
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        while (svg.firstChild) svg.removeChild(svg.firstChild);

        var pos = {};
        EVENTS.forEach(function (ev) { pos[ev.id] = anchors(ev, origin, narrow); });

        linkStats = { total: 0, crossing: 0 };
        THREADS.forEach(function (t, ti) {
            var railX = spineX + (ti - (THREADS.length - 1) / 2) * gap;
            var members = EVENTS.filter(function (ev) { return ev.threads.indexOf(t.id) >= 0; });
            for (var i = 0; i < members.length - 1; i++) {
                var A = pos[members[i].id], B = pos[members[i + 1].id];
                var p = document.createElementNS(SVG_NS, 'path');
                p.setAttribute('d', pathD(A.ox, A.oy, B.ix, B.iy, railX));
                p.setAttribute('stroke', t.color);
                p.setAttribute('data-thread', t.id);
                if (state === t.id) p.classList.add('active');
                svg.appendChild(p);
                linkStats.total++;
                if (members[i].side !== members[i + 1].side) linkStats.crossing++;
            }
        });
        footer();
    }

    function footer() {
        var knots = EVENTS.filter(function (ev) { return ev.side === 'both'; }).length;
        $('tlFoot').textContent = EVENTS.length + ' events, ' + knots + ' of them knots on the spine. ' +
            THREADS.length + ' threads with ' + linkStats.total + ' links, ' + linkStats.crossing +
            ' of which cross from one strand to the other. Not to scale.';
    }

    // ---------------------------------------------------------------
    // Thread selector (isolate mode)
    // ---------------------------------------------------------------

    var state = null;   // null | thread id | 'knots'
    var bar = $('threadBar'), desc = $('threadDesc');

    function makeButton(id, name, color, extraClass) {
        var b = el('button', 'tbtn' + (extraClass ? ' ' + extraClass : ''));
        b.setAttribute('data-thread', id);
        var sw = el('span', 'sw');
        if (color) sw.style.setProperty('--c', color);
        b.appendChild(sw);
        b.appendChild(document.createTextNode(name));
        b.addEventListener('click', function () { setThread(state === id ? null : id); });
        return b;
    }

    var allBtn = el('button', 'tbtn active', 'all');
    allBtn.setAttribute('data-thread', '');
    allBtn.addEventListener('click', function () { setThread(null); });
    bar.appendChild(allBtn);
    THREADS.forEach(function (t) { bar.appendChild(makeButton(t.id, t.name, t.color)); });
    bar.appendChild(makeButton('knots', 'knots', null, 'knots'));

    function setThread(id) {
        state = id;
        tl.classList.toggle('isolate', !!id);

        var buttons = bar.querySelectorAll('.tbtn');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].classList.toggle('active', buttons[i].getAttribute('data-thread') === (id || ''));
        }

        var paths = svg.querySelectorAll('path');
        for (var j = 0; j < paths.length; j++) {
            paths[j].classList.remove('hl');
            paths[j].classList.toggle('active', paths[j].getAttribute('data-thread') === id);
        }

        var count = 0, crossing = 0, prev = null;
        EVENTS.forEach(function (ev) {
            var inSet = id === 'knots' ? ev.side === 'both' : (id ? ev.threads.indexOf(id) >= 0 : false);
            cards[ev.id].classList.toggle('in', inSet);
            cards[ev.id].classList.remove('hl');
            if (inSet) {
                count++;
                if (prev && prev.side !== ev.side) crossing++;
                prev = ev;
            }
        });

        if (!id) {
            desc.textContent = 'Hover or focus an event to see its threads; pick a thread to isolate it; tap an event to read more.';
        } else if (id === 'knots') {
            desc.textContent = 'Knots: ' + count + ' moments that belonged to both fields at once.';
        } else {
            var t = THREAD_BY_ID[id];
            desc.textContent = '';
            desc.appendChild(document.createTextNode(t.name + ': ' + t.desc + ' '));
            desc.appendChild(el('span', 'count', '(' + count + ' events, ' + crossing + ' crossings between strands)'));
        }
    }

    // "trace" links in the patterns section
    var traces = document.querySelectorAll('[data-trace]');
    for (var k = 0; k < traces.length; k++) {
        traces[k].addEventListener('click', function (e) {
            e.preventDefault();
            setThread(this.getAttribute('data-trace'));
            var target = document.getElementById('timeline');
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    // ---------------------------------------------------------------
    // Layout changes: redraw
    // ---------------------------------------------------------------

    var resizeTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(drawThreads, 120);
    });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawThreads);
    window.addEventListener('load', drawThreads);

    setThread(null);
    drawThreads();
})();
