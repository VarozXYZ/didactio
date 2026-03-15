import type { DetailedUnit } from '../types'

export const didacticUnit: DetailedUnit = {
    id: 'unit-123',
    listingId: 1,
    title: 'Introduction to Quantum Computing',
    subject: 'Physics & Computer Science',
    progress: 65,
    lastEdited: '12 mins ago',
    coverColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    status: 'ready',
    level: 'Advanced',
    readingTime: '45 min',
    chapters: [
        {
            id: 'ch-1',
            title: 'The Classical Foundation',
            status: 'ready',
            summary:
                'Understanding the transition from bits to qubits by reviewing classical logic gates and information theory.',
            readingTime: '8 min',
            content: `
        <h2>Introduction</h2>
        <p>Before we dive into the quantum world, we must first solidify our understanding of classical computation. In the classical realm, information is processed as bits&mdash;binary digits that can exist in one of two states: 0 or 1.</p>

        <h3>The Bit as a Unit of Information</h3>
        <p>A bit is the smallest unit of data in a computer. It represents a logical state with one of two possible values. These values are most commonly represented as either 0 or 1, but other representations such as true/false, on/off, or yes/no are equally valid conceptual models.</p>

        <p>The power of bits lies in their simplicity and reliability. Digital computers manipulate vast quantities of bits to perform complex calculations, store information, and communicate across networks. The entire foundation of modern computing&mdash;from your smartphone to supercomputers&mdash;is built upon the manipulation of bits through logic gates.</p>

        <h3>Classical Logic Gates</h3>
        <p>Logic gates are the fundamental building blocks of digital circuits. They perform basic logical operations on one or more binary inputs to produce a single binary output. The most common gates include AND, OR, NOT, NAND, NOR, XOR, and XNOR.</p>

        <p>The AND gate, for instance, outputs 1 only when all of its inputs are 1. The OR gate outputs 1 when at least one input is 1. The NOT gate simply inverts its input&mdash;turning 0 into 1 and vice versa. These simple operations, when combined in sophisticated ways, enable computers to perform everything from basic arithmetic to artificial intelligence.</p>

        <h3>Information Theory and Shannon's Legacy</h3>
        <p>Claude Shannon's groundbreaking work in 1948 established information theory, providing a mathematical framework for quantifying, storing, and communicating information. Shannon introduced the concept of entropy in information systems, measuring the uncertainty or randomness of information content.</p>

        <p>His work demonstrated that information could be compressed without loss up to a certain theoretical limit, and that reliable communication was possible even over noisy channels by using error-correcting codes. These principles remain foundational to modern telecommunications, data compression, and cryptography.</p>

        <h3>The Limits of Classical Computing</h3>
        <p>Despite the incredible achievements of classical computing, there are fundamental limitations to what conventional computers can efficiently accomplish. Certain problems&mdash;such as factoring large numbers, simulating quantum systems, or searching unsorted databases&mdash;require exponential time as problem size increases.</p>

        <p>This is where quantum computing enters the picture. By harnessing the principles of quantum mechanics&mdash;superposition, entanglement, and interference&mdash;quantum computers can potentially solve certain classes of problems exponentially faster than classical machines.</p>
      `,
            learningGoals: [
                'Define a bit and understand its role in classical computing',
                'Understand logic gates and their operations',
                'Explain binary states and digital information',
                'Recognize the limits of classical computation',
            ],
            keyPoints: [
                'Bits are the fundamental unit of classical information',
                'Logic gates perform operations on bits to enable computation',
                "Shannon's information theory provides the mathematical foundation",
                'Classical computing has inherent limits for certain problem classes',
            ],
            level: 'Intermediate',
            effort: 'Low',
        },
        {
            id: 'ch-2',
            title: 'Superposition and Qubits',
            status: 'ready',
            summary:
                'Exploring how quantum bits differ from classical bits and the power of superposition in quantum computing.',
            readingTime: '12 min',
            content: `
        <h2>Introduction to Quantum Bits</h2>
        <p>Unlike classical bits which exist in a definite state of 0 or 1, quantum bits&mdash;or qubits&mdash;can exist in a superposition of both states simultaneously. This fundamental difference is what gives quantum computers their extraordinary potential power.</p>

        <h3>What is Superposition?</h3>
        <p>Superposition is one of the most counterintuitive principles of quantum mechanics. When a qubit is in superposition, it exists in all possible states at once until it is measured. Upon measurement, the superposition collapses to one of the definite states&mdash;either 0 or 1.</p>

        <p>Mathematically, we represent a qubit's state as a linear combination of the basis states |0&gt; and |1&gt;. The general state of a qubit can be written as: |&psi;&gt; = &alpha;|0&gt; + &beta;|1&gt;, where &alpha; and &beta; are complex numbers called probability amplitudes, and |&alpha;|&sup2; + |&beta;|&sup2; = 1.</p>

        <h3>The Bloch Sphere Representation</h3>
        <p>To visualize the state of a single qubit, physicists use the Bloch sphere&mdash;a geometrical representation where any pure qubit state corresponds to a point on the surface of a unit sphere. The north pole represents |0&gt;, the south pole represents |1&gt;, and points on the equator represent equal superpositions.</p>

        <p>This representation helps us understand quantum operations as rotations on the Bloch sphere. Different quantum gates can be visualized as rotating the qubit state around different axes, providing an intuitive geometric picture of quantum computation.</p>

        <h3>Measuring Qubits</h3>
        <p>Measurement is a special operation in quantum mechanics. When we measure a qubit in superposition, we do not get to see the superposition itself&mdash;instead, the act of measurement forces the qubit to choose one of its basis states randomly, with probabilities determined by the amplitudes &alpha; and &beta;.</p>

        <p>This means that if we prepare many identical qubits in the same superposition state and measure each one, we will get 0 approximately |&alpha;|&sup2; of the time and 1 approximately |&beta;|&sup2; of the time. The superposition is destroyed by measurement, a phenomenon known as wave function collapse.</p>

        <h3>Multiple Qubits and Exponential Growth</h3>
        <p>The real power of quantum computing emerges when we consider systems of multiple qubits. Two classical bits can represent exactly one of four possible states: 00, 01, 10, or 11. However, two qubits in superposition can simultaneously represent all four states at once.</p>

        <p>This exponential scaling continues: n qubits can simultaneously represent 2^n different states. With just 300 qubits in perfect superposition, we could represent more states than there are atoms in the observable universe&mdash;a truly staggering computational space.</p>

        <h3>Quantum Parallelism</h3>
        <p>Because a quantum computer can process all superposed states simultaneously, it achieves a form of massive parallelism. A quantum algorithm operating on n qubits effectively performs 2^n computations in parallel&mdash;far beyond what any classical computer could achieve.</p>

        <p>However, this does not mean quantum computers are universally faster. The challenge lies in designing algorithms that exploit this parallelism and then extracting useful information through measurement. Many quantum algorithms are carefully constructed to amplify the probability of measuring the correct answer while suppressing incorrect ones.</p>
      `,
            learningGoals: [
                'Understand Superposition and its implications',
                'Learn the mathematical notation (Ket notation)',
                'Calculate probability amplitudes',
                'Visualize quantum states using the Bloch sphere',
            ],
            keyPoints: [
                'Qubits exist in superposition until measured',
                'The Bloch sphere provides geometric visualization',
                'Measurement collapses superposition probabilistically',
                'Multiple qubits enable exponential computational space',
                'Quantum parallelism offers massive simultaneous processing',
            ],
            level: 'Advanced',
            effort: 'Medium',
        },
        {
            id: 'ch-3',
            title: 'Quantum Entanglement',
            status: 'generating',
            summary:
                "Understanding the strange phenomenon Einstein called 'spooky action at a distance' and its role in quantum computing.",
            readingTime: '10 min',
            content: null,
            learningGoals: [
                'Define Entanglement',
                'Explain Bell States',
                'Understand quantum correlations',
            ],
            keyPoints: [],
            level: 'Advanced',
            effort: 'High',
        },
        {
            id: 'ch-4',
            title: 'Quantum Gates and Circuits',
            status: 'ready',
            summary:
                'Learning about the quantum equivalents of classical logic gates and how to build quantum circuits.',
            readingTime: '15 min',
            content: `
        <h2>Building Blocks of Quantum Computation</h2>
        <p>Just as classical computers use logic gates to manipulate bits, quantum computers use quantum gates to manipulate qubits. However, quantum gates must obey the laws of quantum mechanics, which impose unique constraints and enable unique capabilities.</p>

        <h3>Reversibility of Quantum Gates</h3>
        <p>All quantum gates must be reversible&mdash;meaning they can be undone by applying their inverse operation. This requirement stems from the unitary nature of quantum evolution. In contrast, classical gates like AND or OR are irreversible because multiple inputs can produce the same output, losing information in the process.</p>

        <p>The mathematical property that ensures reversibility is called unitarity. A unitary operator U satisfies U&dagger;U = I, where U&dagger; is the conjugate transpose of U and I is the identity matrix. This guarantees that quantum operations preserve the total probability and can be reversed.</p>

        <h3>Single-Qubit Gates</h3>
        <p>The simplest quantum gates operate on a single qubit. The Pauli gates (X, Y, Z) are fundamental single-qubit operations. The X gate, also known as the quantum NOT gate, flips |0&gt; to |1&gt; and vice versa&mdash;the quantum equivalent of the classical NOT operation.</p>

        <p>The Hadamard gate (H) is perhaps the most important single-qubit gate. It creates an equal superposition: applying H to |0&gt; produces (|0&gt; + |1&gt;)/&radic;2, and applying it to |1&gt; produces (|0&gt; - |1&gt;)/&radic;2. This gate is essential for creating superposition states and is used in nearly every quantum algorithm.</p>

        <p>Phase gates, including the S gate and T gate, leave the |0&gt; state unchanged but add a phase to the |1&gt; component. The S gate adds a phase of i (90 degrees), while the T gate adds a phase of e^(i&pi;/4) (45 degrees). While these phase changes are not directly observable through measurement, they are crucial for interference effects that make quantum algorithms work.</p>

        <h3>Two-Qubit Gates</h3>
        <p>Two-qubit gates are where quantum computing truly diverges from classical computing. The most important two-qubit gate is the CNOT (Controlled-NOT) gate, which flips the second qubit (target) if and only if the first qubit (control) is |1&gt;. This gate is universal for classical computation and forms the basis of quantum entanglement.</p>

        <p>The CNOT gate can create entangled states. For example, applying CNOT to a superposition state |+&gt;|0&gt; produces the maximally entangled Bell state (|00&gt; + |11&gt;)/&radic;2. These entangled states exhibit correlations that have no classical analog and are essential for quantum algorithms and quantum communication protocols.</p>

        <h3>Universal Gate Sets</h3>
        <p>Just as classical computation can be performed using NAND gates alone, quantum computation has universal gate sets that can approximate any quantum operation to arbitrary precision. One common universal set consists of the Hadamard gate, the T gate, and the CNOT gate.</p>

        <p>The Solovay-Kitaev theorem guarantees that any single-qubit gate can be approximated efficiently using a sequence of gates from a finite universal set. This is crucial for practical quantum computing because physical quantum computers can only implement a limited set of native gates.</p>

        <h3>Quantum Circuits</h3>
        <p>Quantum algorithms are typically represented as quantum circuits&mdash;diagrams showing how qubits flow through a sequence of quantum gates. Time flows from left to right, horizontal lines represent qubits, and boxes represent gates. This visual representation makes it easy to understand the structure of quantum algorithms.</p>

        <p>Unlike classical circuits, quantum circuits must carefully manage measurement. Because measurement collapses superposition, it is typically only performed at the end of the computation. Intermediate measurements can be used strategically but require careful design to avoid destroying quantum information prematurely.</p>
      `,
            learningGoals: [
                'Understand the reversibility requirement for quantum gates',
                'Learn about Pauli gates and their operations',
                'Master the Hadamard gate and its role in creating superposition',
                'Explore two-qubit gates like CNOT and their entangling properties',
            ],
            keyPoints: [
                'Quantum gates must be reversible (unitary)',
                'Pauli gates perform basic qubit rotations',
                'Hadamard gate creates superposition states',
                'Phase gates enable quantum interference effects',
                'CNOT gate creates entanglement between qubits',
                'Universal gate sets can approximate any quantum operation',
            ],
            level: 'Advanced',
            effort: 'High',
        },
    ],
}
