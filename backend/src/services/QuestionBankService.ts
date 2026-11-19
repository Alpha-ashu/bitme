import crypto from 'crypto';
import { db } from '../db/Database';
import { QuizCategory, QuizQuestionClient } from '../types';
import { AnalyticsService } from './AnalyticsService';

export interface QuestionBankEntry {
  questionId: string;
  category: QuizCategory;
  subcategory: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  minLevel: number;
  maxLevel: number;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  language: string;
  tags: string[];
  mediaUrl?: string;
  status: 'active' | 'draft' | 'archived';
  version: number;
  updatedAt?: string;
}

export interface QuizSessionRow {
  id: string;
  userId: string;
  questSessionId?: string;
  levelNumber: number;
  category: QuizCategory;
  seed: string;
  questionIds: string[];
  currentIndex: number;
  correctCount: number;
  wrongCount: number;
  passThreshold: number;
  untimed: boolean;
  status: 'active' | 'passed' | 'failed';
  startedAt: string;
  completedAt?: string;
}

// Curated, age-appropriate, multi-difficulty question dataset across Word, Math, Memory & Logic.
const CURATED_QUESTIONS: Omit<QuestionBankEntry, 'version' | 'updatedAt'>[] = [
  // ── WORD PUZZLES (Difficulty 1–5) ──
  { questionId: 'w_101', category: 'word', subcategory: 'missing_letter', difficulty: 1, minLevel: 1, maxLevel: 250, questionText: 'Complete the forest word: S _ A K E', options: ['N', 'M', 'R', 'P'], correctAnswer: 'N', explanation: 'S-N-A-K-E spells SNAKE.', language: 'en', tags: ['spelling', 'nature'], status: 'active' },
  { questionId: 'w_102', category: 'word', subcategory: 'missing_letter', difficulty: 1, minLevel: 1, maxLevel: 250, questionText: 'Fill the missing letter: C R _ W N', options: ['O', 'A', 'U', 'E'], correctAnswer: 'O', explanation: 'C-R-O-W-N spells CROWN, the royal symbol of the park.', language: 'en', tags: ['spelling', 'story'], status: 'active' },
  { questionId: 'w_103', category: 'word', subcategory: 'word_matching', difficulty: 1, minLevel: 1, maxLevel: 250, questionText: 'Which word means a small red forest fruit?', options: ['Cherry', 'Stone', 'River', 'Cloud'], correctAnswer: 'Cherry', explanation: 'A cherry is a sweet red fruit collected in Emerald Hollow.', language: 'en', tags: ['vocabulary', 'nature'], status: 'active' },
  { questionId: 'w_104', category: 'word', subcategory: 'scrambled', difficulty: 1, minLevel: 1, maxLevel: 300, questionText: 'Unscramble the glowing sky collectible: R A T S', options: ['STAR', 'ARTS', 'RATS', 'TARS'], correctAnswer: 'STAR', explanation: 'Rearranging R-A-T-S gives STAR, the glowing crown fragment.', language: 'en', tags: ['anagram', 'story'], status: 'active' },
  { questionId: 'w_105', category: 'word', subcategory: 'spelling', difficulty: 1, minLevel: 1, maxLevel: 300, questionText: 'Choose the correctly spelled word for a green leafy place:', options: ['Forest', 'Forrestt', 'Foresst', 'Forist'], correctAnswer: 'Forest', explanation: 'Forest is spelled F-O-R-E-S-T.', language: 'en', tags: ['spelling'], status: 'active' },
  { questionId: 'w_106', category: 'word', subcategory: 'word_completion', difficulty: 1, minLevel: 1, maxLevel: 300, questionText: 'A safe spring of water in the park is a P O _ _.', options: ['ND', 'ST', 'RT', 'LE'], correctAnswer: 'ND', explanation: 'P-O-N-D spells POND, where snakes heal and cleanse poison.', language: 'en', tags: ['completion'], status: 'active' },
  { questionId: 'w_201', category: 'word', subcategory: 'vocabulary', difficulty: 2, minLevel: 5, maxLevel: 500, questionText: 'What is a synonym for "BRAVE"?', options: ['Courageous', 'Sleepy', 'Quiet', 'Tiny'], correctAnswer: 'Courageous', explanation: 'Courageous means brave and fearless when facing challenges.', language: 'en', tags: ['synonyms'], status: 'active' },
  { questionId: 'w_202', category: 'word', subcategory: 'scrambled', difficulty: 2, minLevel: 5, maxLevel: 500, questionText: 'Unscramble this protective power: D L E I H S', options: ['SHIELD', 'SLIDED', 'SHELDS', 'HILDES'], correctAnswer: 'SHIELD', explanation: 'D-L-E-I-H-S unscrambles to SHIELD.', language: 'en', tags: ['anagram'], status: 'active' },
  { questionId: 'w_203', category: 'word', subcategory: 'missing_letter', difficulty: 2, minLevel: 10, maxLevel: 600, questionText: 'Complete the gem name: E M _ R A L D', options: ['E', 'A', 'I', 'O'], correctAnswer: 'E', explanation: 'E-M-E-R-A-L-D is a rich green jewel.', language: 'en', tags: ['spelling'], status: 'active' },
  { questionId: 'w_204', category: 'word', subcategory: 'vocabulary', difficulty: 2, minLevel: 10, maxLevel: 600, questionText: 'Which word is the OPPOSITE of "ANCIENT"?', options: ['Modern', 'Hidden', 'Hollow', 'Golden'], correctAnswer: 'Modern', explanation: 'Ancient means very old; modern means recent or new.', language: 'en', tags: ['antonyms'], status: 'active' },
  { questionId: 'w_205', category: 'word', subcategory: 'word_search', difficulty: 2, minLevel: 10, maxLevel: 600, questionText: 'Which hidden animal appears inside "X F R O G K P"?', options: ['FROG', 'WOLF', 'BEAR', 'DEER'], correctAnswer: 'FROG', explanation: 'Letters 2–5 spell F-R-O-G.', language: 'en', tags: ['word_search'], status: 'active' },
  { questionId: 'w_301', category: 'word', subcategory: 'vocabulary', difficulty: 3, minLevel: 40, maxLevel: 900, questionText: 'What does "SANCTUARY" mean?', options: ['A place of safety and refuge', 'A steep volcanic cliff', 'A fast rushing wind', 'A locked stone chest'], correctAnswer: 'A place of safety and refuge', explanation: 'A sanctuary protects travelers from harm.', language: 'en', tags: ['vocabulary'], status: 'active' },
  { questionId: 'w_302', category: 'word', subcategory: 'scrambled', difficulty: 3, minLevel: 40, maxLevel: 900, questionText: 'Unscramble the realm title: M O D G N I K', options: ['KINGDOM', 'DOMKING', 'MINDKOG', 'KINGSOM'], correctAnswer: 'KINGDOM', explanation: 'M-O-D-G-N-I-K unscrambles to KINGDOM.', language: 'en', tags: ['anagram'], status: 'active' },
  { questionId: 'w_303', category: 'word', subcategory: 'spelling', difficulty: 3, minLevel: 60, maxLevel: 1000, questionText: 'Which spelling is correct for a glowing blue crystal cavern?', options: ['Luminous', 'Luminoos', 'Luminus', 'Lumenous'], correctAnswer: 'Luminous', explanation: 'Luminous means bright or glowing in the dark.', language: 'en', tags: ['spelling'], status: 'active' },
  { questionId: 'w_304', category: 'word', subcategory: 'word_matching', difficulty: 3, minLevel: 60, maxLevel: 1000, questionText: 'Which word best completes: "The compass helps an explorer ____ the maze."', options: ['navigate', 'hibernate', 'evaporate', 'decorate'], correctAnswer: 'navigate', explanation: 'Navigate means to find your way through a route.', language: 'en', tags: ['context'], status: 'active' },
  { questionId: 'w_401', category: 'word', subcategory: 'vocabulary', difficulty: 4, minLevel: 200, maxLevel: 1000, questionText: 'Which word means "working together toward a shared goal"?', options: ['Collaboration', 'Isolation', 'Hesitation', 'Evaporation'], correctAnswer: 'Collaboration', explanation: 'Collaboration is teamwork to achieve a shared objective.', language: 'en', tags: ['vocabulary'], status: 'active' },
  { questionId: 'w_402', category: 'word', subcategory: 'scrambled', difficulty: 4, minLevel: 250, maxLevel: 1000, questionText: 'Unscramble the defender title: N A I D R A U G', options: ['GUARDIAN', 'GRADUANI', 'GAURDIAN', 'DARIANGU'], correctAnswer: 'GUARDIAN', explanation: 'N-A-I-D-R-A-U-G spells GUARDIAN.', language: 'en', tags: ['anagram'], status: 'active' },
  { questionId: 'w_501', category: 'word', subcategory: 'vocabulary', difficulty: 5, minLevel: 500, maxLevel: 1000, questionText: 'What does "SOVEREIGN" describe?', options: ['A supreme ruler or monarch', 'A fragile autumn leaf', 'A shallow muddy brook', 'A hurried whisper'], correctAnswer: 'A supreme ruler or monarch', explanation: 'Sovereign refers to a rightful monarch or supreme authority.', language: 'en', tags: ['vocabulary', 'endgame'], status: 'active' },
  { questionId: 'w_502', category: 'word', subcategory: 'vocabulary', difficulty: 5, minLevel: 600, maxLevel: 1000, questionText: 'Choose the closest synonym for "RESILIENT":', options: ['Adaptable and strong', 'Fragile and brief', 'Predictable and slow', 'Silent and unseen'], correctAnswer: 'Adaptable and strong', explanation: 'Resilient means able to recover quickly from challenges.', language: 'en', tags: ['synonyms'], status: 'active' },

  // ── MATHEMATICS (Difficulty 1–5) ──
  { questionId: 'm_101', category: 'math', subcategory: 'addition', difficulty: 1, minLevel: 1, maxLevel: 200, questionText: 'You collect 4 cherries and then 5 more. How many cherries in total?', options: ['9', '8', '10', '7'], correctAnswer: '9', explanation: '4 + 5 = 9 cherries.', language: 'en', tags: ['addition'], status: 'active' },
  { questionId: 'm_102', category: 'math', subcategory: 'subtraction', difficulty: 1, minLevel: 1, maxLevel: 200, questionText: 'You have 12 stars and spend 5 stars. How many stars remain?', options: ['7', '6', '8', '5'], correctAnswer: '7', explanation: '12 - 5 = 7 remaining stars.', language: 'en', tags: ['subtraction'], status: 'active' },
  { questionId: 'm_103', category: 'math', subcategory: 'addition', difficulty: 1, minLevel: 1, maxLevel: 250, questionText: 'What is 8 + 7?', options: ['15', '14', '16', '13'], correctAnswer: '15', explanation: '8 + 7 = 15.', language: 'en', tags: ['addition'], status: 'active' },
  { questionId: 'm_104', category: 'math', subcategory: 'sequence', difficulty: 1, minLevel: 1, maxLevel: 300, questionText: 'Find the next number in the sequence: 2, 4, 6, 8, ___', options: ['10', '9', '12', '11'], correctAnswer: '10', explanation: 'The pattern adds 2 each step: 8 + 2 = 10.', language: 'en', tags: ['sequence'], status: 'active' },
  { questionId: 'm_105', category: 'math', subcategory: 'missing_number', difficulty: 1, minLevel: 1, maxLevel: 300, questionText: 'Fill in the missing number: 6 + ___ = 14', options: ['8', '7', '9', '6'], correctAnswer: '8', explanation: '14 - 6 = 8, so 6 + 8 = 14.', language: 'en', tags: ['algebra_basic'], status: 'active' },
  { questionId: 'm_106', category: 'math', subcategory: 'subtraction', difficulty: 1, minLevel: 1, maxLevel: 300, questionText: 'What is 19 - 6?', options: ['13', '12', '14', '11'], correctAnswer: '13', explanation: '19 - 6 = 13.', language: 'en', tags: ['subtraction'], status: 'active' },
  { questionId: 'm_201', category: 'math', subcategory: 'multiplication', difficulty: 2, minLevel: 8, maxLevel: 500, questionText: '3 chests each hold 6 star fragments. How many fragments total?', options: ['18', '15', '21', '12'], correctAnswer: '18', explanation: '3 × 6 = 18 star fragments.', language: 'en', tags: ['multiplication'], status: 'active' },
  { questionId: 'm_202', category: 'math', subcategory: 'division', difficulty: 2, minLevel: 8, maxLevel: 500, questionText: '24 apples are shared equally among 4 villagers. How many does each get?', options: ['6', '5', '8', '4'], correctAnswer: '6', explanation: '24 ÷ 4 = 6 apples each.', language: 'en', tags: ['division'], status: 'active' },
  { questionId: 'm_203', category: 'math', subcategory: 'sequence', difficulty: 2, minLevel: 10, maxLevel: 600, questionText: 'What comes next? 5, 10, 15, 20, ___', options: ['25', '24', '30', '22'], correctAnswer: '25', explanation: 'Each step increases by 5: 20 + 5 = 25.', language: 'en', tags: ['sequence'], status: 'active' },
  { questionId: 'm_204', category: 'math', subcategory: 'multiplication', difficulty: 2, minLevel: 10, maxLevel: 600, questionText: 'What is 7 × 8?', options: ['56', '54', '48', '64'], correctAnswer: '56', explanation: '7 × 8 = 56.', language: 'en', tags: ['multiplication'], status: 'active' },
  { questionId: 'm_205', category: 'math', subcategory: 'division', difficulty: 2, minLevel: 15, maxLevel: 650, questionText: 'What is 45 ÷ 9?', options: ['5', '6', '4', '7'], correctAnswer: '5', explanation: '9 × 5 = 45, so 45 ÷ 9 = 5.', language: 'en', tags: ['division'], status: 'active' },
  { questionId: 'm_301', category: 'math', subcategory: 'math_logic', difficulty: 3, minLevel: 40, maxLevel: 900, questionText: 'A snake gains 15 points per crystal and 10 per apple. What is the score for 3 crystals + 2 apples?', options: ['65', '55', '70', '60'], correctAnswer: '65', explanation: '(3 × 15) + (2 × 10) = 45 + 20 = 65.', language: 'en', tags: ['multi_step'], status: 'active' },
  { questionId: 'm_302', category: 'math', subcategory: 'sequence', difficulty: 3, minLevel: 50, maxLevel: 1000, questionText: 'Find the next number: 3, 6, 12, 24, ___', options: ['48', '36', '42', '30'], correctAnswer: '48', explanation: 'Each number doubles: 24 × 2 = 48.', language: 'en', tags: ['geometric'], status: 'active' },
  { questionId: 'm_303', category: 'math', subcategory: 'missing_number', difficulty: 3, minLevel: 60, maxLevel: 1000, questionText: 'Solve for N: 4 × N + 6 = 34', options: ['7', '6', '8', '9'], correctAnswer: '7', explanation: '34 - 6 = 28, and 28 ÷ 4 = 7.', language: 'en', tags: ['equation'], status: 'active' },
  { questionId: 'm_401', category: 'math', subcategory: 'math_logic', difficulty: 4, minLevel: 200, maxLevel: 1000, questionText: 'A shield lasts 8 seconds and stacks +5 seconds per pickup, up to 30s. After 3 extra pickups, how long is it?', options: ['23s', '25s', '18s', '30s'], correctAnswer: '23s', explanation: '8 + (3 × 5) = 23 seconds (under the 30s cap).', language: 'en', tags: ['word_problem'], status: 'active' },
  { questionId: 'm_402', category: 'math', subcategory: 'sequence', difficulty: 4, minLevel: 250, maxLevel: 1000, questionText: 'What comes next in the sequence: 1, 4, 9, 16, 25, ___', options: ['36', '32', '35', '49'], correctAnswer: '36', explanation: 'These are square numbers: 1², 2², 3², 4², 5², 6² = 36.', language: 'en', tags: ['squares'], status: 'active' },
  { questionId: 'm_501', category: 'math', subcategory: 'math_logic', difficulty: 5, minLevel: 500, maxLevel: 1000, questionText: 'Two snakes collect 120 stars together. One collects 3 times as many as the other. How many did the larger collector gather?', options: ['90', '80', '100', '75'], correctAnswer: '90', explanation: 'x + 3x = 120 → x = 30, so 3x = 90 stars.', language: 'en', tags: ['algebra'], status: 'active' },
  { questionId: 'm_502', category: 'math', subcategory: 'sequence', difficulty: 5, minLevel: 600, maxLevel: 1000, questionText: 'Find the next Fibonacci number: 2, 3, 5, 8, 13, 21, ___', options: ['34', '32', '35', '31'], correctAnswer: '34', explanation: 'Each term is the sum of the two before it: 13 + 21 = 34.', language: 'en', tags: ['fibonacci'], status: 'active' },

  // ── MEMORY & PATTERN RECALL (Difficulty 1–5) ──
  { questionId: 'mem_101', category: 'memory', subcategory: 'pattern_repeat', difficulty: 1, minLevel: 1, maxLevel: 250, questionText: 'Remember the rune order: ⭐ 🍒 ⭐ 🍒 ___ — which symbol comes next?', options: ['⭐', '🍒', '💎', '🛡️'], correctAnswer: '⭐', explanation: 'It alternates Star, Cherry, Star, Cherry → next is ⭐.', language: 'en', tags: ['pattern'], status: 'active' },
  { questionId: 'mem_102', category: 'memory', subcategory: 'symbol_match', difficulty: 1, minLevel: 1, maxLevel: 300, questionText: 'A chest showed: 🌳 🌊 🔥. Which symbol was in the MIDDLE?', options: ['🌊', '🌳', '🔥', '❄️'], correctAnswer: '🌊', explanation: 'In 🌳 🌊 🔥, the middle symbol is 🌊.', language: 'en', tags: ['recall'], status: 'active' },
  { questionId: 'mem_103', category: 'memory', subcategory: 'pattern_repeat', difficulty: 1, minLevel: 1, maxLevel: 300, questionText: 'Complete the beacon pattern: 🔵 🟢 🔵 🟢 🔵 ___', options: ['🟢', '🔵', '🔴', '🟡'], correctAnswer: '🟢', explanation: 'Alternating Blue and Green puts 🟢 after Blue.', language: 'en', tags: ['pattern'], status: 'active' },
  { questionId: 'mem_104', category: 'memory', subcategory: 'object_recall', difficulty: 1, minLevel: 1, maxLevel: 350, questionText: 'Order of village shrines: North = 🍒, East = ⭐, South = 💎. Which shrine is East?', options: ['⭐', '🍒', '💎', '🔥'], correctAnswer: '⭐', explanation: 'The East shrine holds ⭐.', language: 'en', tags: ['positions'], status: 'active' },
  { questionId: 'mem_201', category: 'memory', subcategory: 'sequence_recall', difficulty: 2, minLevel: 6, maxLevel: 500, questionText: 'Match the mirror sequence of [🛡️, ⚡, ⭐]:', options: ['⭐, ⚡, 🛡️', '⚡, 🛡️, ⭐', '🛡️, ⭐, ⚡', '⭐, 🛡️, ⚡'], correctAnswer: '⭐, ⚡, 🛡️', explanation: 'Reversing [🛡️, ⚡, ⭐] gives [⭐, ⚡, 🛡️].', language: 'en', tags: ['reverse'], status: 'active' },
  { questionId: 'mem_202', category: 'memory', subcategory: 'pattern_repeat', difficulty: 2, minLevel: 10, maxLevel: 600, questionText: 'Continue the 3-step cycle: 🍎 💎 ⭐ 🍎 💎 ___', options: ['⭐', '🍎', '💎', '🍒'], correctAnswer: '⭐', explanation: 'The repeating 3-item cycle is Apple, Gem, Star → next is ⭐.', language: 'en', tags: ['cycle'], status: 'active' },
  { questionId: 'mem_203', category: 'memory', subcategory: 'symbol_match', difficulty: 2, minLevel: 12, maxLevel: 650, questionText: 'Code sequence: A1 - B2 - C3 - D4. What pairs with E?', options: ['E5', 'E4', 'E6', 'F5'], correctAnswer: 'E5', explanation: 'Each letter pairs with its alphabet position: E is 5 → E5.', language: 'en', tags: ['pairing'], status: 'active' },
  { questionId: 'mem_301', category: 'memory', subcategory: 'object_recall', difficulty: 3, minLevel: 30, maxLevel: 900, questionText: 'Four lanterns lit in order: 1:Red, 2:Gold, 3:Blue, 4:Green. Which color lit THIRD?', options: ['Blue', 'Gold', 'Green', 'Red'], correctAnswer: 'Blue', explanation: 'Position 3 in Red → Gold → Blue → Green is Blue.', language: 'en', tags: ['order'], status: 'active' },
  { questionId: 'mem_302', category: 'memory', subcategory: 'pattern_repeat', difficulty: 3, minLevel: 50, maxLevel: 1000, questionText: 'Spot the missing pair: 🌙⭐  🌙⭐⭐  🌙⭐⭐⭐  ___', options: ['🌙⭐⭐⭐⭐', '🌙🌙⭐⭐⭐', '⭐🌙⭐⭐⭐', '🌙⭐⭐'], correctAnswer: '🌙⭐⭐⭐⭐', explanation: 'Each step keeps one moon and adds one more star.', language: 'en', tags: ['growth_pattern'], status: 'active' },
  { questionId: 'mem_401', category: 'memory', subcategory: 'sequence_recall', difficulty: 4, minLevel: 200, maxLevel: 1000, questionText: 'Keystone code: [🔥, ❄️, 🌿, 🌊] shifted 1 step right becomes:', options: ['[🌊, 🔥, ❄️, 🌿]', '[❄️, 🌿, 🌊, 🔥]', '[🌿, 🌊, 🔥, ❄️]', '[🔥, 🌿, ❄️, 🌊]'], correctAnswer: '[🌊, 🔥, ❄️, 🌿]', explanation: 'Shifting right moves the last item (🌊) to the front.', language: 'en', tags: ['shift'], status: 'active' },
  { questionId: 'mem_501', category: 'memory', subcategory: 'sequence_recall', difficulty: 5, minLevel: 500, maxLevel: 1000, questionText: 'Five realm seals in order: Hollow, Reach, Ashfall, Silence, Bloomfall. Which seal stands between Ashfall and Bloomfall?', options: ['Silence', 'Reach', 'Hollow', 'Spire'], correctAnswer: 'Silence', explanation: 'White Silence is Realm 4, directly between Ashfall (3) and Bloomfall (5).', language: 'en', tags: ['campaign_lore'], status: 'active' },

  // ── LOGIC & STRATEGY (Difficulty 1–5) ──
  { questionId: 'l_101', category: 'logic', subcategory: 'path_choice', difficulty: 1, minLevel: 1, maxLevel: 300, questionText: 'You are poisoned by a Danger Skull! Which park object cleanses poison and heals you?', options: ['Waterfall Pond', 'Volcano', 'Skull Bomb', 'Stone Outcrop'], correctAnswer: 'Waterfall Pond', explanation: 'Waterfall Ponds cleanse Poison Curse and restore HP.', language: 'en', tags: ['strategy', 'world'], status: 'active' },
  { questionId: 'l_102', category: 'logic', subcategory: 'sequence', difficulty: 1, minLevel: 1, maxLevel: 300, questionText: 'Which item does NOT belong in the fruit basket?', options: ['Stone', 'Cherry', 'Apple', 'Berry'], correctAnswer: 'Stone', explanation: 'Stone is a rock obstacle, while Cherry, Apple, and Berry are fruits.', language: 'en', tags: ['odd_one_out'], status: 'active' },
  { questionId: 'l_103', category: 'logic', subcategory: 'ability_order', difficulty: 1, minLevel: 1, maxLevel: 350, questionText: 'A Skull Bomb blocks a narrow path. What should you activate BEFORE touching it to defuse it safely?', options: ['Guard Shield', 'Stand still', 'Touch lava first', 'Turn off minimap'], correctAnswer: 'Guard Shield', explanation: 'An active Shield safely defuses Skull Bombs for bonus points!', language: 'en', tags: ['strategy'], status: 'active' },
  { questionId: 'l_104', category: 'logic', subcategory: 'deduction', difficulty: 1, minLevel: 1, maxLevel: 350, questionText: 'All emerald keys open green gates. You hold an emerald key. What can you open?', options: ['A green gate', 'Only red gates', 'Nothing', 'A volcano'], correctAnswer: 'A green gate', explanation: 'Because all emerald keys open green gates, yours opens a green gate.', language: 'en', tags: ['deduction'], status: 'active' },
  { questionId: 'l_201', category: 'logic', subcategory: 'path_choice', difficulty: 2, minLevel: 8, maxLevel: 550, questionText: 'Path A has 2 cherries (10 pts each). Path B has 1 crystal (40 pts). Which path scores higher?', options: ['Path B (40 pts)', 'Path A (20 pts)', 'Both are equal', 'Neither scores'], correctAnswer: 'Path B (40 pts)', explanation: 'Path B gives 40 points versus 20 points on Path A.', language: 'en', tags: ['resource_strategy'], status: 'active' },
  { questionId: 'l_202', category: 'logic', subcategory: 'deduction', difficulty: 2, minLevel: 10, maxLevel: 600, questionText: 'Elder Moss is older than Bram. Bram is older than Pip. Who is the youngest?', options: ['Pip', 'Bram', 'Elder Moss', 'Cannot tell'], correctAnswer: 'Pip', explanation: 'Moss > Bram > Pip, making Pip the youngest.', language: 'en', tags: ['ordering'], status: 'active' },
  { questionId: 'l_203', category: 'logic', subcategory: 'gate_puzzle', difficulty: 2, minLevel: 12, maxLevel: 650, questionText: 'Gate 1 needs 2 Switches. You already lit 1 Switch and have 15 seconds left. What is your best move?', options: ['Sprint to the 2nd Switch', 'Wait in the corner', 'Restart immediately', 'Ignore switches'], correctAnswer: 'Sprint to the 2nd Switch', explanation: 'Activating the 2nd Switch unlocks the gate before time runs out.', language: 'en', tags: ['objective'], status: 'active' },
  { questionId: 'l_301', category: 'logic', subcategory: 'resource_management', difficulty: 3, minLevel: 40, maxLevel: 900, questionText: 'In Team Battle Royale, your team is down by 10 points with 20s left. A Team Relic worth 15 points is nearby. Best play?', options: ['Grab & deliver the Relic to base', 'Hide outside zones', 'Avoid all objectives', 'Leave the match'], correctAnswer: 'Grab & deliver the Relic to base', explanation: 'Delivering a 15-point Team Relic flips a 10-point deficit into a +5 lead!', language: 'en', tags: ['team_strategy'], status: 'active' },
  { questionId: 'l_302', category: 'logic', subcategory: 'deduction', difficulty: 3, minLevel: 50, maxLevel: 1000, questionText: 'Three doors: Door A says "Treasure is here." Door B says "Door A is lying." Only ONE sign is true. Where is the treasure?', options: ['Behind Door B or C (not A)', 'Behind Door A', 'Behind every door', 'Nowhere'], correctAnswer: 'Behind Door B or C (not A)', explanation: 'Wait — if A were true, B would be false (consistent!); if B is true, A is false. Since only one is true, check: wait if A is false then treasure is NOT behind A. Both A-false (B true) works cleanly.', language: 'en', tags: ['logic_riddle'], status: 'active' },
  { questionId: 'l_303', category: 'logic', subcategory: 'sequence', difficulty: 3, minLevel: 60, maxLevel: 1000, questionText: 'Switch X opens North Gate, Switch Y opens East Gate. To reach the Shrine behind East Gate, which switch matters first?', options: ['Switch Y', 'Switch X', 'Neither switch', 'Both locked forever'], correctAnswer: 'Switch Y', explanation: 'Switch Y directly unlocks the East Gate leading to the Shrine.', language: 'en', tags: ['causal'], status: 'active' },
  { questionId: 'l_401', category: 'logic', subcategory: 'resource_management', difficulty: 4, minLevel: 200, maxLevel: 1000, questionText: 'Boost burns body length if above 8 segments. If you are at 10 segments and racing a closing storm, when should you boost?', options: ['In short controlled bursts toward safe zone', 'Continuously in circles', 'Never move', 'Into a volcano'], correctAnswer: 'In short controlled bursts toward safe zone', explanation: 'Controlled bursts cross the storm edge quickly without wasting control.', language: 'en', tags: ['survival_strategy'], status: 'active' },
  { questionId: 'l_501', category: 'logic', subcategory: 'deduction', difficulty: 5, minLevel: 500, maxLevel: 1000, questionText: 'In a 3-stage Milestone Boss, Stage 1 is Trial, Stage 2 is Knowledge, Stage 3 is Final Guardian. If you clear Stage 2 and disconnect, what should happen on reconnect?', options: ['Resume from Stage 3 without losing progress', 'Reset to Level 1', 'Delete stars', 'Skip boss with no play'], correctAnswer: 'Resume from Stage 3 without losing progress', explanation: 'Persistent multi-stage progress saves cleared stages across reconnects!', language: 'en', tags: ['campaign'], status: 'active' },
];

// Deterministic PRNG (Mulberry32) driven by a server-generated seed.
function mulberry32(seedStr: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class QuestionBankService {
  private static seeded = false;

  public static ensureSeeded(): void {
    if (this.seeded) return;
    const conn = db.getRawDb();
    const row = conn.prepare('SELECT COUNT(*) AS cnt FROM question_bank').get() as { cnt: number };
    if ((row?.cnt || 0) === 0) {
      const now = new Date().toISOString();
      const stmt = conn.prepare(`
        INSERT OR IGNORE INTO question_bank (
          question_id, category, subcategory, difficulty, min_level, max_level,
          question_text, options_json, correct_answer, explanation, language,
          tags_json, media_url, status, version, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const q of CURATED_QUESTIONS) {
        stmt.run(
          q.questionId,
          q.category,
          q.subcategory,
          q.difficulty,
          q.minLevel,
          q.maxLevel,
          q.questionText,
          JSON.stringify(q.options),
          q.correctAnswer,
          q.explanation,
          q.language,
          JSON.stringify(q.tags),
          q.mediaUrl || null,
          q.status,
          1,
          now
        );
      }
    }
    this.seeded = true;
  }

  private static rowToEntry(r: any): QuestionBankEntry {
    const parseArr = (s: string | null) => {
      if (!s) return [];
      try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
    };
    return {
      questionId: r.question_id,
      category: r.category as QuizCategory,
      subcategory: r.subcategory || '',
      difficulty: Math.max(1, Math.min(5, Number(r.difficulty) || 1)) as 1 | 2 | 3 | 4 | 5,
      minLevel: Number(r.min_level) || 1,
      maxLevel: Number(r.max_level) || 1000,
      questionText: r.question_text,
      options: parseArr(r.options_json),
      correctAnswer: r.correct_answer,
      explanation: r.explanation || '',
      language: r.language || 'en',
      tags: parseArr(r.tags_json),
      mediaUrl: r.media_url || undefined,
      status: (r.status || 'active') as any,
      version: Number(r.version) || 1,
      updatedAt: r.updated_at,
    };
  }

  /**
   * Performance-adaptive difficulty calculation (never depends on player age):
   * combines campaign level band, recent accuracy %, attempt count, and response speed.
   */
  public static computeAdaptiveDifficulty(userId: string, levelNumber: number): 1 | 2 | 3 | 4 | 5 {
    const baseDiff = levelNumber <= 25 ? 1 : levelNumber <= 120 ? 2 : levelNumber <= 350 ? 3 : levelNumber <= 700 ? 4 : 5;
    const conn = db.getRawDb();
    const stats = conn.prepare(`
      SELECT COUNT(*) AS attempts,
             SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct,
             AVG(response_ms) AS avg_ms
      FROM (
        SELECT is_correct, response_ms FROM question_attempts
        WHERE user_id = ?
        ORDER BY id DESC LIMIT 12
      )
    `).get(userId) as { attempts: number; correct: number; avg_ms: number | null };

    if (!stats || stats.attempts < 3) return baseDiff as 1 | 2 | 3 | 4 | 5;
    const accuracy = stats.correct / stats.attempts;
    const avgMs = stats.avg_ms || 6000;
    let delta = 0;
    if (accuracy >= 0.85 && avgMs < 8000) delta = 1;
    else if (accuracy <= 0.45) delta = -1;
    return Math.max(1, Math.min(5, baseDiff + delta)) as 1 | 2 | 3 | 4 | 5;
  }

  /**
   * Seeded, non-repeating question selection strictly controlled by the server.
   * Never returns correct_answer to the client.
   */
  public static createQuizSession(
    userId: string,
    opts: {
      questSessionId?: string;
      levelNumber: number;
      category: QuizCategory;
      count?: number;
      untimed?: boolean;
      language?: string;
    }
  ): { session: QuizSessionRow; firstQuestion: QuizQuestionClient } {
    this.ensureSeeded();
    const conn = db.getRawDb();
    const count = Math.max(1, Math.min(8, opts.count || 3));
    const targetDiff = this.computeAdaptiveDifficulty(userId, opts.levelNumber);
    const lang = opts.language || 'en';

    // Pull active questions matching category + language
    const allRows = conn.prepare(`
      SELECT * FROM question_bank
      WHERE category = ? AND status = 'active' AND language = ?
    `).all(opts.category, lang);

    const pool = allRows.map(r => this.rowToEntry(r));
    if (pool.length === 0) {
      throw new Error(`No active questions available for category "${opts.category}"`);
    }

    // Recent questions shown to this player (avoid repeats in short sessions)
    const recentRows = conn.prepare(`
      SELECT question_id FROM question_attempts
      WHERE user_id = ?
      ORDER BY id DESC LIMIT 20
    `).all(userId) as Array<{ question_id: string }>;
    const recentSet = new Set(recentRows.map(r => r.question_id));

    const seed = crypto.randomBytes(6).toString('hex');
    const rng = mulberry32(`${seed}:${userId}:${opts.levelNumber}`);

    // Score each candidate by level fit, adaptive difficulty closeness, and novelty
    const scored = pool.map(q => {
      const inLevelBand = opts.levelNumber >= q.minLevel && opts.levelNumber <= q.maxLevel ? 0 : 2;
      const diffGap = Math.abs(q.difficulty - targetDiff);
      const repeatPenalty = recentSet.has(q.questionId) ? 10 : 0;
      return { q, rank: repeatPenalty + diffGap * 2 + inLevelBand + rng() * 1.4 };
    }).sort((a, b) => a.rank - b.rank);

    const selectedIds: string[] = [];
    for (const item of scored) {
      if (selectedIds.length >= count) break;
      if (!selectedIds.includes(item.q.questionId)) selectedIds.push(item.q.questionId);
    }

    const sessionId = `quiz_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const passThreshold = Math.max(1, Math.ceil(selectedIds.length * 0.6));
    const untimed = opts.untimed ?? (opts.levelNumber <= 15);
    const now = new Date().toISOString();

    conn.prepare(`
      INSERT INTO quiz_sessions (
        id, user_id, quest_session_id, level_number, category, seed,
        question_ids_json, current_index, correct_count, wrong_count,
        pass_threshold, untimed, status, started_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?, 'active', ?)
    `).run(
      sessionId,
      userId,
      opts.questSessionId || null,
      opts.levelNumber,
      opts.category,
      seed,
      JSON.stringify(selectedIds),
      passThreshold,
      untimed ? 1 : 0,
      now
    );

    AnalyticsService.track({
      eventType: 'quiz_start',
      userId,
      mode: 'explorer',
      metadata: {
        quizSessionId: sessionId,
        questSessionId: opts.questSessionId,
        levelNumber: opts.levelNumber,
        category: opts.category,
        targetDifficulty: targetDiff,
        questionCount: selectedIds.length,
      },
    });

    const session: QuizSessionRow = {
      id: sessionId,
      userId,
      questSessionId: opts.questSessionId,
      levelNumber: opts.levelNumber,
      category: opts.category,
      seed,
      questionIds: selectedIds,
      currentIndex: 0,
      correctCount: 0,
      wrongCount: 0,
      passThreshold,
      untimed,
      status: 'active',
      startedAt: now,
    };

    const firstQuestion = this.buildClientQuestion(session, 0)!;
    return { session, firstQuestion };
  }

  public static getSession(userId: string, quizSessionId: string): { session: QuizSessionRow; currentQuestion: QuizQuestionClient | null } | null {
    this.ensureSeeded();
    const conn = db.getRawDb();
    const r = conn.prepare('SELECT * FROM quiz_sessions WHERE id = ? AND user_id = ?').get(quizSessionId, userId) as any;
    if (!r) return null;
    const session: QuizSessionRow = {
      id: r.id,
      userId: r.user_id,
      questSessionId: r.quest_session_id || undefined,
      levelNumber: r.level_number,
      category: r.category as QuizCategory,
      seed: r.seed,
      questionIds: JSON.parse(r.question_ids_json || '[]'),
      currentIndex: r.current_index,
      correctCount: r.correct_count,
      wrongCount: r.wrong_count,
      passThreshold: r.pass_threshold,
      untimed: !!r.untimed,
      status: r.status,
      startedAt: r.started_at,
      completedAt: r.completed_at || undefined,
    };
    const currentQuestion = session.status === 'active'
      ? this.buildClientQuestion(session, session.currentIndex)
      : null;
    return { session, currentQuestion };
  }

  private static buildClientQuestion(session: QuizSessionRow, idx: number): QuizQuestionClient | null {
    const qId = session.questionIds[idx];
    if (!qId) return null;
    const conn = db.getRawDb();
    const row = conn.prepare('SELECT * FROM question_bank WHERE question_id = ?').get(qId);
    if (!row) return null;
    const entry = this.rowToEntry(row);

    // Deterministically shuffle options per session + question index (never reveals answer position)
    const rng = mulberry32(`${session.seed}:${qId}:${idx}`);
    const shuffledOptions = [...entry.options];
    for (let i = shuffledOptions.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
    }

    // Strict client projection — NEVER includes correctAnswer or explanation before grading!
    return {
      quizSessionId: session.id,
      questionId: entry.questionId,
      index: idx,
      total: session.questionIds.length,
      category: entry.category,
      subcategory: entry.subcategory,
      difficulty: entry.difficulty,
      questionText: entry.questionText,
      options: shuffledOptions,
      untimed: session.untimed,
      timeLimitSec: session.untimed ? 0 : Math.max(18, 34 - entry.difficulty * 3),
      correctCount: session.correctCount,
      wrongCount: session.wrongCount,
      passThreshold: session.passThreshold,
      mediaUrl: entry.mediaUrl,
    };
  }

  /**
   * Authoritative server-side answer validation & recording.
   */
  public static submitAnswer(
    userId: string,
    quizSessionId: string,
    questionId: string,
    submittedAnswer: string,
    responseMs = 0
  ): {
    ok: boolean;
    error?: string;
    isCorrect?: boolean;
    correctAnswer?: string;
    explanation?: string;
    correctCount?: number;
    wrongCount?: number;
    total?: number;
    passThreshold?: number;
    completed?: boolean;
    passed?: boolean;
    nextQuestion?: QuizQuestionClient | null;
    questSessionId?: string;
  } {
    this.ensureSeeded();
    const loaded = this.getSession(userId, quizSessionId);
    if (!loaded) return { ok: false, error: 'Quiz session not found' };
    const { session } = loaded;
    if (session.status !== 'active') return { ok: false, error: 'Quiz session already completed' };

    const expectedQId = session.questionIds[session.currentIndex];
    if (!expectedQId || expectedQId !== questionId) {
      return { ok: false, error: 'Question out of sequence' };
    }

    const conn = db.getRawDb();
    const qRow = conn.prepare('SELECT * FROM question_bank WHERE question_id = ?').get(expectedQId);
    if (!qRow) return { ok: false, error: 'Question no longer exists' };
    const entry = this.rowToEntry(qRow);

    const cleanAnswer = String(submittedAnswer ?? '').trim();
    if (!cleanAnswer || !entry.options.some(o => o.trim().toLowerCase() === cleanAnswer.toLowerCase())) {
      return { ok: false, error: 'Invalid answer option submitted' };
    }

    const isCorrect = cleanAnswer.toLowerCase() === entry.correctAnswer.trim().toLowerCase();
    const safeMs = Math.max(0, Math.min(300_000, Math.round(Number(responseMs) || 0)));
    const now = new Date().toISOString();

    conn.prepare(`
      INSERT INTO question_attempts (
        quiz_session_id, user_id, question_id, submitted_answer, is_correct, response_ms, difficulty, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(session.id, userId, entry.questionId, cleanAnswer, isCorrect ? 1 : 0, safeMs, entry.difficulty, now);

    const nextIndex = session.currentIndex + 1;
    const nextCorrect = session.correctCount + (isCorrect ? 1 : 0);
    const nextWrong = session.wrongCount + (isCorrect ? 0 : 1);
    const completed = nextIndex >= session.questionIds.length;
    const passed = completed && nextCorrect >= session.passThreshold;
    const nextStatus = completed ? (passed ? 'passed' : 'failed') : 'active';

    conn.prepare(`
      UPDATE quiz_sessions
      SET current_index = ?, correct_count = ?, wrong_count = ?, status = ?, completed_at = ?
      WHERE id = ?
    `).run(nextIndex, nextCorrect, nextWrong, nextStatus, completed ? now : null, session.id);

    AnalyticsService.track({
      eventType: 'quiz_answer',
      userId,
      mode: 'explorer',
      durationSeconds: Math.round(safeMs / 1000),
      metadata: {
        quizSessionId: session.id,
        questionId: entry.questionId,
        category: entry.category,
        difficulty: entry.difficulty,
        isCorrect,
        responseMs: safeMs,
      },
    });

    if (completed) {
      AnalyticsService.track({
        eventType: 'quiz_complete',
        userId,
        mode: 'explorer',
        score: nextCorrect,
        metadata: {
          quizSessionId: session.id,
          questSessionId: session.questSessionId,
          levelNumber: session.levelNumber,
          category: session.category,
          correctCount: nextCorrect,
          total: session.questionIds.length,
          passed,
        },
      });
    }

    session.currentIndex = nextIndex;
    session.correctCount = nextCorrect;
    session.wrongCount = nextWrong;
    session.status = nextStatus;

    return {
      ok: true,
      isCorrect,
      correctAnswer: entry.correctAnswer,
      explanation: entry.explanation,
      correctCount: nextCorrect,
      wrongCount: nextWrong,
      total: session.questionIds.length,
      passThreshold: session.passThreshold,
      completed,
      passed,
      nextQuestion: completed ? null : this.buildClientQuestion(session, nextIndex),
      questSessionId: session.questSessionId,
    };
  }

  // ── Admin CMS Content Management ──
  public static listQuestions(filters?: { category?: string; difficulty?: number; status?: string; limit?: number }): QuestionBankEntry[] {
    this.ensureSeeded();
    const conn = db.getRawDb();
    const where: string[] = [];
    const params: any[] = [];
    if (filters?.category) { where.push('category = ?'); params.push(filters.category); }
    if (filters?.difficulty) { where.push('difficulty = ?'); params.push(filters.difficulty); }
    if (filters?.status) {
      const normStatus = filters.status === 'published' ? 'active' : filters.status;
      where.push('status = ?');
      params.push(normStatus);
    }
    const limit = Math.max(1, Math.min(300, Number(filters?.limit) || 120));
    const sql = `SELECT * FROM question_bank ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY category, difficulty, question_id LIMIT ?`;
    params.push(limit);
    return conn.prepare(sql).all(...params).map(r => this.rowToEntry(r));
  }

  public static upsertQuestion(input: Partial<QuestionBankEntry> & { prompt?: string }): { ok: boolean; error?: string; question?: QuestionBankEntry } {
    this.ensureSeeded();
    const category = String(input.category || '') as QuizCategory;
    if (!['word', 'math', 'memory', 'logic'].includes(category)) {
      return { ok: false, error: 'Category must be word, math, memory, or logic' };
    }
    const questionText = String(input.questionText || input.prompt || '').trim();
    if (questionText.length < 5) return { ok: false, error: 'Question text must be at least 5 characters' };
    const options = Array.isArray(input.options) ? input.options.map(o => String(o).trim()).filter(Boolean) : [];
    if (options.length < 2 || options.length > 6) return { ok: false, error: 'Provide between 2 and 6 answer options' };
    const correctAnswer = String(input.correctAnswer || '').trim();
    if (!options.some(o => o.toLowerCase() === correctAnswer.toLowerCase())) {
      return { ok: false, error: 'Correct answer must match one of the provided options' };
    }

    const questionId = String(input.questionId || '').trim() || `q_${category}_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const difficulty = Math.max(1, Math.min(5, Math.round(Number(input.difficulty) || 1))) as 1 | 2 | 3 | 4 | 5;
    const minLevel = Math.max(1, Math.min(1000, Math.round(Number(input.minLevel) || 1)));
    const maxLevel = Math.max(minLevel, Math.min(1000, Math.round(Number(input.maxLevel) || 1000)));
    const rawStatus = String(input.status || 'active');
    const mappedStatus = rawStatus === 'published' ? 'active' : rawStatus;
    const status = (['active', 'draft', 'archived'].includes(mappedStatus) ? mappedStatus : 'active') as 'active' | 'draft' | 'archived';
    const now = new Date().toISOString();

    const conn = db.getRawDb();
    const prev = conn.prepare('SELECT version FROM question_bank WHERE question_id = ?').get(questionId) as { version: number } | undefined;
    const version = prev ? prev.version + 1 : 1;

    conn.prepare(`
      INSERT OR REPLACE INTO question_bank (
        question_id, category, subcategory, difficulty, min_level, max_level,
        question_text, options_json, correct_answer, explanation, language,
        tags_json, media_url, status, version, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      questionId,
      category,
      String(input.subcategory || 'general').trim(),
      difficulty,
      minLevel,
      maxLevel,
      questionText,
      JSON.stringify(options),
      correctAnswer,
      String(input.explanation || '').trim(),
      String(input.language || 'en').trim() || 'en',
      JSON.stringify(Array.isArray(input.tags) ? input.tags.map(String) : []),
      input.mediaUrl ? String(input.mediaUrl) : null,
      status,
      version,
      now
    );

    const saved = conn.prepare('SELECT * FROM question_bank WHERE question_id = ?').get(questionId);
    return { ok: true, question: this.rowToEntry(saved) };
  }

  public static deleteQuestion(questionId: string): boolean {
    this.ensureSeeded();
    const r = db.getRawDb().prepare('DELETE FROM question_bank WHERE question_id = ?').run(questionId);
    return (r.changes || 0) > 0;
  }
}
