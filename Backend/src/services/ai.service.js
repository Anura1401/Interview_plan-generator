const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer = require("puppeteer")

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
})

const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's resume and self-description match the job description"),
    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question asked during the interview"),
        intention: z.string().describe("The intention of interviewer behind asking the technical question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take, what mistakes to avoid")
    })).describe("Technical questions that can be asked in interview along with intention and how to answer them"),
    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The behavioral question asked during the interview"),
        intention: z.string().describe("The intention of interviewer behind asking the behavioral question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take, what mistakes to avoid")
    })).describe("Behavioural questions that can be asked in interview along with intention and how to answer them"),
    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill that the candidate is lacking"),
        severity: z.enum(["low", "medium", "high"]).describe("How critical it is for the candidate to improve this skill")
    })).describe("List of skill gaps in candidate's profile along with severity"),
    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, e.g., 1, 2, 3"),
        focus: z.string().describe("The main focus of preparation for that day"),
        tasks: z.array(z.string()).describe("A list of specific tasks to complete on that day")
    })).describe("A day-wise preparation plan for the candidate"),
    title: z.string().describe("The title of the job for which the interview report is generated")
})

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    const prompt = `You are an expert technical interviewer and talent assessor.
Generate an interview report for a candidate applying for a target role.

Target Job Description:
${jobDescription}

Candidate Resume:
${resume}

Candidate Self-Description:
${selfDescription}

Please perform a thorough cross-reference of the candidate's skills, experience, and self-description against the target job requirements.
1. Determine a tailored Job Title for this specific application.
2. Calculate a Match Score (0 to 100) reflecting how well their background aligns with the job. Be honest and realistic based on actual skill overlaps.
3. Select 3-5 highly relevant Technical Questions that target the specific technologies/skills required by the job and either mention/test candidate's claimed experience OR target critical areas of the job.
4. Select 2-3 Behavioral Questions that probe the candidate's soft skills and engineering culture, tailored to their seniority level.
5. Identify explicit Skill Gaps (skills required by the job but missing or weak in the candidate's profile) with low, medium, or high severity.
6. Create a tailored day-by-day Preparation Plan focusing on addressing those skill gaps and brushing up on the matched technology stacks.`

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: zodToJsonSchema(interviewReportSchema)
            }
        })

        return JSON.parse(response.text)
    } catch (error) {
        console.warn("Gemini API call failed, falling back to mock generation:", error.message || error)
        return generateMockInterviewReport(resume, selfDescription, jobDescription)
    }
}

async function generatePdffromHtml(htmlContent) {
    const browser = await puppeteer.launch()
    const page = await browser.newPage()
    await page.setContent(htmlContent, { waitUntil: "networkidle0" })

    const pdfBuffer = await page.pdf({
        format: "A4",
        margin: {
            top: "20mm",
            bottom: "20mm",
            left: "15mm",
            right: "15mm"
        }
    })

    await browser.close()
    return pdfBuffer
}

async function generateResumePDF({ resume, selfDescription, jobDescription }) {
    const resumepdfSchema = z.object({
        html: z.string().describe("The HTML content of the resume PDF")
    })

    const prompt = `You are a professional resume writer and career coach.
Generate a highly polished, tailored resume for a candidate seeking the role described in the Job Description.

Candidate Resume Text:
${resume}

Candidate Self-Description:
${selfDescription}

Target Job Description:
${jobDescription}

Please return the resume as a single, beautiful HTML document.
1. Structuring:
   - Include a clean header with the candidate's name (large, bold) and contact details (email, phone, location) formatted horizontally.
   - Organize into structured sections: Professional Summary, Core Skills, Professional Experience (with bullet points), and Education.
   - Rewrite and tailor the experience bullet points to directly highlight relevant accomplishments and match keywords from the Job Description.
2. Styling & Design Rules (CSS inside <style> tag):
   - Use clean, modern system fonts: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif.
   - Use a premium, professional color palette: primary colors like deep navy/blue (#1e3a8a, #2563eb) for headers, #1e293b for body text, and light grey background accents. Avoid raw primary colors (like red or green).
   - Set clean padding/margins (e.g. margin: 20px, line-height: 1.5) so it fits elegantly on 1-2 pages without clipping.
   - Do NOT include any diagnostic boxes, fallback warnings, or container borders. It should look like a ready-to-use professional resume document.

The response should be a JSON object with a single field "html" containing the complete HTML content of the resume.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: zodToJsonSchema(resumepdfSchema),
            }
        })

        const jsonContent = JSON.parse(response.text)
        const pdfBuffer = await generatePdffromHtml(jsonContent.html)
        return pdfBuffer
    } catch (error) {
        console.warn("Gemini Resume API failed, falling back to mock PDF resume:", error.message || error)
        const mockHtml = generateMockResumeHtml(resume, selfDescription, jobDescription)
        const pdfBuffer = await generatePdffromHtml(mockHtml)
        return pdfBuffer
    }
}

const TECH_CATALOG = {
    react: {
        name: "React.js",
        technicalQuestions: [
            {
                question: "Can you explain the difference between virtual DOM and real DOM in React?",
                intention: "Assess deep understanding of React's rendering pipeline and performance optimizations.",
                answer: "The virtual DOM is a lightweight, in-memory representation of the real DOM. React uses it to track state changes and perform 'diffing'. When state updates, React computes the minimal set of changes and updates the real DOM in a single batched operation, which is much faster than manipulating the real DOM directly."
            },
            {
                question: "What are React Hooks and how do they differ from class component lifecycle methods?",
                intention: "Assess understanding of React's functional component paradigm and hooks API.",
                answer: "React Hooks (like useState, useEffect, useMemo) let functional components manage state, side effects, and lifecycle events without writing class components. They promote code reusability, make code easier to test, and eliminate the confusion around the 'this' context in Javascript classes."
            }
        ]
    },
    node: {
        name: "Node.js / Express",
        technicalQuestions: [
            {
                question: "How do you handle asynchronous operations and error states in Node.js/Express?",
                intention: "Assess familiarity with modern JS async patterns, event loop behavior, and clean error handling.",
                answer: "Use async/await with try/catch blocks for clean, readable code. For event-driven logic, attach error handlers to event emitters or streams. Always handle unhandled promise rejections and use global error-handling middlewares in Express."
            },
            {
                question: "Explain the Node.js event loop and how it handles concurrency despite being single-threaded.",
                intention: "Evaluate core knowledge of Node's runtime engine and async execution.",
                answer: "The event loop offloads I/O operations (like database queries, network requests) to the operating system or pool threads (libuv) because standard JS execution is single-threaded. When async tasks complete, their callbacks are pushed to the callback queue, which the event loop executes in phases when the main execution stack is empty."
            }
        ]
    },
    python: {
        name: "Python",
        technicalQuestions: [
            {
                question: "What is the Global Interpreter Lock (GIL) in Python and how does it affect multi-threading?",
                intention: "Assess deep runtime knowledge and concurrency optimization skills in Python.",
                answer: "The GIL is a mutex that protects access to Python objects, preventing multiple threads from executing Python bytecodes at once. This makes Python single-threaded per process. To utilize multiple CPU cores for CPU-bound tasks, developers use multiprocessing instead of threading, while threading remains useful for I/O-bound tasks."
            },
            {
                question: "What is the difference between list comprehensions and generators in Python?",
                intention: "Check knowledge of memory-efficient coding patterns in Python.",
                answer: "List comprehensions create the entire list in memory immediately, which is faster for small collections but memory-intensive. Generators yield elements lazily (one at a time) using the 'yield' keyword, requiring O(1) memory space, making them ideal for large or infinite datasets."
            }
        ]
    },
    javascript: {
        name: "JavaScript / TypeScript",
        technicalQuestions: [
            {
                question: "What is the difference between synchronous and asynchronous code execution in JavaScript?",
                intention: "Assess fundamental understanding of JS concurrency and event-driven runtime.",
                answer: "Synchronous code runs line-by-line, blocking execution of subsequent lines until the current one finishes. Asynchronous code (using promises, callbacks, or async/await) lets tasks run in the background, executing a callback when done without blocking the main thread."
            },
            {
                question: "Explain closures and prototypal inheritance in JavaScript.",
                intention: "Check advanced language features and scope understanding.",
                answer: "A closure is the combination of a function bundled together with references to its surrounding state (lexical environment), allowing it to remember variables from its outer scope even after the outer function has executed. Prototypal inheritance means objects inherit properties and methods directly from other objects via a prototype chain, rather than through classes as in classical OOP."
            }
        ]
    },
    "machine learning": {
        name: "Machine Learning / AI",
        technicalQuestions: [
            {
                question: "What is the difference between supervised and unsupervised learning?",
                intention: "Assess core understanding of machine learning paradigms.",
                answer: "Supervised learning uses labeled training data to learn a mapping from inputs to outputs (e.g. classification or regression). Unsupervised learning finds hidden patterns or intrinsic structures in input data without labeled target values (e.g. clustering or dimensionality reduction)."
            },
            {
                question: "How do you handle overfitting in machine learning models?",
                intention: "Assess knowledge of model regularization and generalization techniques.",
                answer: "Overfitting can be reduced by using cross-validation, gathering more training data, reducing model complexity (fewer parameters), applying regularization techniques (like L1/L2 lasso/ridge), or using dropout in neural networks."
            }
        ]
    },
    database: {
        name: "Databases (SQL & NoSQL)",
        technicalQuestions: [
            {
                question: "What is your approach to database indexing and query optimization?",
                intention: "Assess database design, indexing knowledge, and database optimization experience.",
                answer: "First, profile queries using EXPLAIN to see if they perform table scans. Create indexes on columns used in WHERE clauses, JOIN conditions, and ORDER BY fields. Avoid over-indexing as it slows down write operations, and use compound indexes for multi-field queries."
            },
            {
                question: "What are the core differences between SQL and NoSQL databases?",
                intention: "Assess architecture choices for data persistence.",
                answer: "SQL databases are relational, table-based, have predefined schemas, and scale vertically, making them great for ACID-compliant complex queries. NoSQL databases are non-relational, document/key-value/graph-based, have dynamic schemas, and scale horizontally, ideal for rapid prototyping and large unstructured data."
            }
        ]
    },
    devops: {
        name: "DevOps & Cloud",
        technicalQuestions: [
            {
                question: "What is Containerization and why is Docker preferred over Virtual Machines?",
                intention: "Assess understanding of modern cloud deployments, isolation, and portability.",
                answer: "Docker containers share the host OS kernel and package application files and dependencies into a lightweight image, whereas Virtual Machines package an entire guest OS. This makes containers start in seconds and consume significantly less RAM and storage than VMs."
            },
            {
                question: "Explain the concept of Continuous Integration and Continuous Deployment (CI/CD).",
                intention: "Evaluate understanding of automated build, test, and release flows.",
                answer: "CI/CD automates the delivery pipeline. CI ensures that when code is pushed, it's automatically built and tested to prevent code regression. CD automatically deploys the tested code to production or staging, reducing human error and speed to market."
            }
        ]
    },
    java: {
        name: "Java",
        technicalQuestions: [
            {
                question: "How does Garbage Collection work in Java?",
                intention: "Assess understanding of JVM memory management.",
                answer: "Java Garbage Collection automatically manages memory by identifying and deleting objects that are no longer referenced by any part of the application. It runs in the background and uses various algorithms (like G1, ZGC) to minimize pause times during execution."
            },
            {
                question: "What is the difference between Abstract Class and Interface in Java?",
                intention: "Evaluate basic OOP concepts and clean design patterns.",
                answer: "An abstract class can have state (instance variables) and both implemented and unimplemented methods, supporting single inheritance. An interface defines a contract (historically only abstract methods, but now default/static methods) and supports multiple inheritance, promoting loose coupling."
            }
        ]
    },
    security: {
        name: "Web Security & Authentication",
        technicalQuestions: [
            {
                question: "How does JWT authentication work and what are the security risks?",
                intention: "Assess knowledge of secure token-based user authentication.",
                answer: "JSON Web Tokens are stateless, signed tokens passed in requests to verify identity. The primary risk is token theft (XSS/CSRF). To secure them, store them in HTTP-only, secure cookies, use short expiration times, and verify the signatures on the server using a strong secret key."
            },
            {
                question: "What is the difference between Encryption, Hashing, and Encoding?",
                intention: "Test cryptography and security fundamentals.",
                answer: "Encryption is two-way (reversible using a key, like AES). Hashing is one-way (irreversible, used for passwords, like bcrypt). Encoding is public transformation of data formatting for transport/storage (not secure, like Base64)."
            }
        ]
    },
    product: {
        name: "Product Management",
        technicalQuestions: [
            {
                question: "How do you prioritize features in a product roadmap when resources are constrained?",
                intention: "Assess prioritisation frameworks, stakeholder management, and product strategy.",
                answer: "I use frameworks like RICE (Reach, Impact, Confidence, Effort) or MoSCoW. I align priorities with business KPIs, run customer feedback analysis, and collaborate with engineering leads to evaluate effort/technical feasibility."
            },
            {
                question: "How do you define and measure the success of a new feature?",
                intention: "Check ability to define product metrics and monitor user behavior.",
                answer: "I establish north star metrics aligned with user engagement, retention, or conversion. I track adoption rates, churn, user feedback, and run A/B testing to ensure features are driving expected business and user value."
            }
        ]
    }
};

const BEHAVIORAL_POOL = {
    general: [
        {
            question: "Tell me about a time you had a conflict with a team member and how you resolved it.",
            intention: "Assess collaboration, empathy, and constructive communication skills.",
            answer: "Explain a specific task conflict (not personal), describe how you scheduled a 1-on-1 to discuss perspectives, listened actively, found common ground (e.g. aligning on overall project success), and established a clear path forward."
        },
        {
            question: "Describe a situation where you had to work under a tight deadline with incomplete requirements.",
            intention: "Assess adaptability, prioritization under pressure, and communication.",
            answer: "Use the STAR method: explain the situation, the task, the actions you took (prioritizing core deliverables, communicating trade-offs to stakeholders, and making safe assumptions), and the successful result."
        }
    ],
    senior: [
        {
            question: "Describe a time you had to advocate for addressing technical debt to stakeholders or product managers who prioritized new features.",
            intention: "Assess influence, communication of technical value in business terms, and long-term vision.",
            answer: "Explain how you quantified the impact of the technical debt (e.g., slower release cycles, higher bug rates, performance issues) and proposed an incremental approach to refactor without completely halting feature development, gaining alignment and business buy-in."
        },
        {
            question: "How do you handle mentoring junior developers while maintaining your own individual deliverables?",
            intention: "Assess leadership, delegation, time management, and support for team growth.",
            answer: "Explain how you structure mentoring (e.g., dedicated office hours, pair programming sessions, thorough code reviews) and promote self-sufficiency by pointing to architectural guidelines, ensuring their growth without compromising project deadlines."
        }
    ]
};

const GRANULAR_SKILLS = {
    react: { name: "React.js", category: "react" },
    redux: { name: "Redux State Management", category: "react" },
    tailwind: { name: "Tailwind CSS", category: "react" },
    node: { name: "Node.js", category: "node" },
    express: { name: "Express.js", category: "node" },
    python: { name: "Python", category: "python" },
    django: { name: "Django Framework", category: "python" },
    flask: { name: "Flask Framework", category: "python" },
    fastapi: { name: "FastAPI", category: "python" },
    javascript: { name: "JavaScript", category: "javascript" },
    typescript: { name: "TypeScript", category: "javascript" },
    "machine learning": { name: "Machine Learning Models", category: "machine learning" },
    "neural networks": { name: "Neural Networks & Deep Learning", category: "machine learning" },
    nlp: { name: "Natural Language Processing (NLP)", category: "machine learning" },
    pytorch: { name: "PyTorch", category: "machine learning" },
    tensorflow: { name: "TensorFlow", category: "machine learning" },
    sql: { name: "SQL Databases", category: "database" },
    postgres: { name: "PostgreSQL", category: "database" },
    mysql: { name: "MySQL", category: "database" },
    mongodb: { name: "MongoDB", category: "database" },
    redis: { name: "Redis Caching", category: "database" },
    oracle: { name: "Oracle Database", category: "database" },
    aws: { name: "AWS Cloud Services", category: "devops" },
    gcp: { name: "Google Cloud Platform (GCP)", category: "devops" },
    azure: { name: "Microsoft Azure", category: "devops" },
    docker: { name: "Docker Containerization", category: "devops" },
    kubernetes: { name: "Kubernetes Orchestration", category: "devops" },
    "ci/cd": { name: "CI/CD Deployment Pipelines", category: "devops" },
    java: { name: "Java", category: "java" },
    spring: { name: "Spring Boot", category: "java" },
    jwt: { name: "JSON Web Tokens (JWT)", category: "security" },
    oauth: { name: "OAuth 2.0 Security", category: "security" },
    scrum: { name: "Scrum Methodology", category: "product" },
    agile: { name: "Agile Product Management", category: "product" }
};

function generateMockInterviewReport(resume, selfDescription, jobDescription) {
    const cleanResume = (resume || "").toLowerCase();
    const cleanSelf = (selfDescription || "").toLowerCase();
    const cleanJob = (jobDescription || "").toLowerCase();
    const combinedCandidate = `${cleanResume} ${cleanSelf}`;
    const combinedAll = `${cleanResume} ${cleanSelf} ${cleanJob}`;

    // 1. Identify matched technologies
    const matches = [];
    const techKeys = Object.keys(TECH_CATALOG);
    
    // Mapping of key aliases to match correctly
    const aliases = {
        react: ["react", "react.js", "frontend"],
        node: ["node", "node.js", "express", "backend"],
        python: ["python", "django", "flask", "fastapi"],
        javascript: ["javascript", "typescript", "js", "ts", "es6"],
        "machine learning": ["machine learning", "data science", "ml", "ai", "deep learning", "nlp", "tensorflow", "pytorch"],
        database: ["sql", "nosql", "database", "postgres", "mysql", "mongodb", "redis", "oracle", "db"],
        devops: ["devops", "aws", "docker", "kubernetes", "cloud", "ci/cd", "jenkins", "gcp", "azure"],
        java: ["java", "spring", "springboot", "jvm"],
        security: ["security", "auth", "jwt", "oauth", "encryption", "ssl"],
        product: ["product manager", "product management", "pm", "roadmap", "scrum", "agile"]
    };

    function checkMatch(searchTerms, sourceText) {
        return searchTerms.some(term => {
            const escaped = term.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            if (/^[a-z]{1,4}$/i.test(term)) {
                return new RegExp(`\\b${escaped}\\b`, 'i').test(sourceText);
            }
            return new RegExp(escaped, 'i').test(sourceText);
        });
    }

    for (const key of techKeys) {
        const searchTerms = aliases[key] || [key];
        const isMatched = checkMatch(searchTerms, cleanJob);
        if (isMatched) {
            matches.push(key);
        }
    }

    // Default to react and node if no matches are found
    if (matches.length === 0) {
        matches.push("react", "node");
    }

    // 2. Identify seniority
    const seniorKeywords = ["senior", "lead", "principal", "architect", "manager", "head", "vp", "sr", "10+", "5+", "years of experience"];
    const isSenior = checkMatch(seniorKeywords, cleanJob);

    // 3. Determine dynamically tailored Job Title
    let title = "";
    const isProduct = matches.includes("product");
    const isML = matches.includes("machine learning");
    const isDevOps = matches.includes("devops") && !matches.includes("react") && !matches.includes("node");
    
    if (isProduct) {
        title = isSenior ? "Senior Product Manager" : "Product Manager";
    } else if (isML) {
        title = isSenior ? "Senior Machine Learning Engineer / Data Scientist" : "Machine Learning Engineer / Data Scientist";
    } else if (isDevOps) {
        title = isSenior ? "Senior Cloud / DevOps Engineer" : "Cloud / DevOps Engineer";
    } else {
        const matchedTechNames = matches
            .filter(m => m !== "javascript" && m !== "security" && m !== "database")
            .map(m => TECH_CATALOG[m].name);
        
        if (matchedTechNames.length > 0) {
            title = (isSenior ? "Senior " : "") + matchedTechNames.slice(0, 2).join(" / ") + " Developer";
        } else {
            title = (isSenior ? "Senior " : "") + "Software Engineer";
        }
    }

    // 4. Compile Technical Questions (collect 1-2 from each matched tech, max 4)
    const technicalQuestions = [];
    for (const match of matches) {
        const catalogItem = TECH_CATALOG[match];
        if (catalogItem && catalogItem.technicalQuestions) {
            // Add up to 2 questions per match
            technicalQuestions.push(...catalogItem.technicalQuestions.slice(0, 2));
        }
    }
    // Cap at 4 technical questions, or ensure we have at least 2
    const finalTechnicalQuestions = technicalQuestions.slice(0, 4);

    // 5. Compile Behavioral Questions
    const finalBehavioralQuestions = isSenior ? BEHAVIORAL_POOL.senior : BEHAVIORAL_POOL.general;

    // 6. Calculate a logical Match Score and Skill Gaps dynamically
    const requiredSkills = [];
    const candidateSkills = [];
    const aspirationSkills = [];
    
    const skillKeys = Object.keys(GRANULAR_SKILLS);
    
    for (const skill of skillKeys) {
        const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = /^[a-z]{1,4}$/i.test(skill) 
            ? new RegExp(`\\b${escaped}\\b`, 'i') 
            : new RegExp(escaped, 'i');
            
        const inJob = regex.test(cleanJob);
        if (inJob) {
            requiredSkills.push(skill);
            
            const inResume = regex.test(cleanResume);
            const inSelf = regex.test(cleanSelf);
            
            if (inResume) {
                candidateSkills.push(skill);
            }
            if (inSelf) {
                aspirationSkills.push(skill);
            }
        }
    }

    let matchScore = 75;
    const skillGaps = [];

    if (requiredSkills.length > 0) {
        let totalPoints = 0;
        for (const skill of requiredSkills) {
            const inResume = candidateSkills.includes(skill);
            const inSelf = aspirationSkills.includes(skill);
            
            if (inResume) {
                totalPoints += 1.0; // Full match
            } else if (inSelf) {
                // If it is only in selfDescription, check if it's transitional
                const isTransitional = cleanSelf.includes("transition") || 
                                       cleanSelf.includes("learn") || 
                                       cleanSelf.includes("aspiring") || 
                                       cleanSelf.includes("want");
                totalPoints += isTransitional ? 0.3 : 0.7;
                
                // Add to skill gaps since it's not on the resume
                const skillInfo = GRANULAR_SKILLS[skill];
                skillGaps.push({
                    skill: skillInfo.name,
                    severity: isTransitional ? "high" : "medium"
                });
            } else {
                // Not matched anywhere
                const skillInfo = GRANULAR_SKILLS[skill];
                skillGaps.push({
                    skill: skillInfo.name,
                    severity: "high"
                });
            }
        }
        matchScore = Math.max(30, Math.min(100, Math.round((totalPoints / requiredSkills.length) * 100)));
    } else {
        // Fallback matching if JD has no specific keywords
        const candidateMatchesCount = techKeys.filter(key => 
            checkMatch(aliases[key] || [key], combinedCandidate)
        ).length;
        matchScore = Math.min(100, 65 + candidateMatchesCount * 5);
        
        // Add a generic gap since no specific requirements were parsed
        skillGaps.push({ skill: "System Design and Scaling", severity: "medium" });
    }

    // 8. Custom Preparation Plan
    const preparationPlan = [];
    const techFocus = matches.map(m => TECH_CATALOG[m]?.name || m).join(", ");
    
    preparationPlan.push({
        day: 1,
        focus: "Core Requirements Review",
        tasks: [
            `Analyze target requirements for the ${title} position.`,
            `Cross-reference core domains: ${techFocus}.`
        ]
    });

    // Day 2 focuses on practicing technical questions for the matched technologies
    preparationPlan.push({
        day: 2,
        focus: "Deep Dive: Technical Concepts",
        tasks: [
            `Study standard questions and answers for: ${matches.map(m => TECH_CATALOG[m]?.name || m).slice(0, 3).join(", ")}.`,
            "Practice coding hands-on and explaining architectural trade-offs."
        ]
    });

    // Day 3 focuses on addressing identified skill gaps
    const gapNames = skillGaps.map(g => g.skill).slice(0, 3).join(" & ");
    preparationPlan.push({
        day: 3,
        focus: gapNames ? `Focus on Gaps: ${gapNames}` : "Practice Behavioral Scenarios",
        tasks: gapNames 
            ? [`Spend time reading documentation on missing skills: ${gapNames}.`, "Prepare simple summaries and architectures for these domains."]
            : ["Prepare STAR responses for core behavioral competencies.", "Run stories about conflict resolution and working under pressure."]
    });

    // Day 4 is mock interview prep
    preparationPlan.push({
        day: 4,
        focus: "Final Mock Interview & Wrap-up",
        tasks: [
            "Conduct a mock interview session practicing the model answers.",
            "Review core metrics, skill gaps, and final elevator pitches."
        ]
    });

    return {
        matchScore,
        title,
        technicalQuestions: finalTechnicalQuestions,
        behavioralQuestions: finalBehavioralQuestions,
        skillGaps,
        preparationPlan
    };
}

function generateMockResumeHtml(resume, selfDescription, jobDescription) {
    const cleanResume = resume || "";
    const cleanSelf = selfDescription || "";
    
    // Parse name: extract first non-empty line of the resume
    const lines = cleanResume.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    let name = "Jane Doe"; // default
    if (lines.length > 0) {
        if (lines[0].length < 40 && !lines[0].includes("@") && !lines[0].includes(":")) {
            name = lines[0];
        }
    }
    
    // Parse email
    const emailMatch = cleanResume.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : "";
    
    // Parse phone
    const phoneMatch = cleanResume.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/);
    const phone = phoneMatch ? phoneMatch[0] : "";
    
    // Parse location
    const locationMatch = cleanResume.match(/\b[A-Za-z\s]+,\s*[A-Z]{2}\b/);
    const location = locationMatch ? locationMatch[0] : "";
    
    // Clean resume text by removing contact info lines
    let bodyResumeText = cleanResume;
    if (email) bodyResumeText = bodyResumeText.replace(email, "");
    if (phone) bodyResumeText = bodyResumeText.replace(phone, "");
    if (location) bodyResumeText = bodyResumeText.replace(location, "");
    
    // Format the clean resume lines
    const formattedBody = bodyResumeText.split("\n")
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .filter((l, i) => i > 0 || l !== name)
        .map(l => {
            if (l.toUpperCase() === l && l.length < 40) {
                return `<h2>${l}</h2>`;
            }
            if (l.startsWith("-") || l.startsWith("*")) {
                return `<li>${l.substring(1).trim()}</li>`;
            }
            return `<p>${l}</p>`;
        })
        .join("\n");

    const contactDetails = [email, phone, location].filter(Boolean).join("  |  ");

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { 
                font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                color: #1e293b; 
                margin: 40px; 
                line-height: 1.6; 
                font-size: 14px;
            }
            header {
                text-align: center;
                border-bottom: 2px solid #2563eb;
                padding-bottom: 15px;
                margin-bottom: 25px;
            }
            h1 { 
                margin: 0 0 5px 0; 
                color: #1e3a8a; 
                font-size: 28px;
                font-weight: 700;
                letter-spacing: -0.025em;
            }
            .contact {
                font-size: 13px;
                color: #64748b;
                font-weight: 500;
            }
            h2 { 
                color: #1e3a8a; 
                margin-top: 25px; 
                margin-bottom: 10px;
                font-size: 16px;
                border-bottom: 1px solid #e2e8f0;
                padding-bottom: 5px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                font-weight: bold;
            }
            p { 
                margin: 0 0 10px 0; 
            }
            ul {
                margin: 0 0 15px 0;
                padding-left: 20px;
            }
            li {
                margin-bottom: 5px;
            }
            .section { 
                margin-bottom: 20px; 
            }
        </style>
    </head>
    <body>
        <header>
            <h1>${name}</h1>
            <div class="contact">${contactDetails}</div>
        </header>

        ${cleanSelf ? `
        <div class="section">
            <h2>Professional Summary</h2>
            <p>${cleanSelf}</p>
        </div>
        ` : ''}

        <div class="section">
            ${formattedBody}
        </div>
    </body>
    </html>
    `;
}

module.exports = { generateInterviewReport, generateResumePDF }