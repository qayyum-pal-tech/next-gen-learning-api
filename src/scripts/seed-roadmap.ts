
import mongoose from 'mongoose';

// Fallback to local if env var not set (dotenv not available in standalone script context)
const MONGODB_URI = 'mongodb://localhost:27017/nextgen-learning';

const roadmapData = {
    _id: "697a55f22d8e3b1f6b1e883f", // Standard ID used in UI
    subject: "react js",
    userId: "001",
    description: "This roadmap is designed for developers who have a foundational understanding of React JS and are looking to deepen their knowledge, master intermediate to advanced concepts, and build more robust, performant, and maintainable applications. It progresses from advanced hooks and state management to performance, testing, and architectural patterns.",
    status: "not_started",
    enabled:true,
    difficultyLevel: "intermediate",
    totalEstimatedDuration: "75-100 hours",
    progressPercentage: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    topics: [
        {
            title: "Advanced React Hooks & Context API",
            order: 1,
            description: "Deepen your understanding of React's built-in hooks and explore the Context API for efficient state propagation without prop drilling.",
            isCompleted: false,
            estimatedDuration: "12-15 hours",
            subtopics: [
                {
                    title: "useCallback, useMemo, and React.memo",
                    order: 1,
                    description: "Understand and apply memoization techniques to optimize component re-renders and prevent unnecessary computations.",
                    isCompleted: false,
                    estimatedDuration: "3 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "useRef for DOM Interaction and Mutable Values",
                    order: 2,
                    description: "Learn to use `useRef` to directly interact with the DOM, store mutable values, and manage focus or media playback.",
                    isCompleted: false,
                    estimatedDuration: "2 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Custom Hooks for Logic Reusability",
                    order: 3,
                    description: "Create your own custom hooks to abstract and reuse stateful logic across different components, promoting cleaner code.",
                    isCompleted: false,
                    estimatedDuration: "4 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Context API with useReducer for Global State",
                    order: 4,
                    description: "Master the Context API combined with `useReducer` to manage global application state effectively without external libraries.",
                    isCompleted: false,
                    estimatedDuration: "4 hours",
                    resources: [],
                    notes: "",
                },
            ],
        },
        {
            title: "Efficient State Management with Redux Toolkit",
            order: 2,
            description:
                "Learn to manage complex and global application state using Redux Toolkit, a powerful and opinionated way to use Redux.",
            subtopics: [
                {
                    title: "Introduction to Redux Toolkit (RTK)",
                    order: 1,
                    description:
                        "Understand the core principles of Redux and how RTK simplifies Redux development with opinionated best practices.",
                    isCompleted: false,
                    estimatedDuration: "3 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Creating Slices, Reducers, and Actions",
                    order: 2,
                    description:
                        "Learn to define state slices, write reducers to handle state changes, and create actions for dispatching updates.",
                    isCompleted: false,
                    estimatedDuration: "5 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Asynchronous Logic with RTK Query / createAsyncThunk",
                    order: 3,
                    description:
                        "Integrate asynchronous operations like API calls using RTK Query for declarative data fetching or `createAsyncThunk` for custom async logic.",
                    isCompleted: false,
                    estimatedDuration: "7 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Integrating RTK with React Components",
                    order: 4,
                    description:
                        "Connect your Redux store to React components using `useSelector` and `useDispatch` hooks.",
                    isCompleted: false,
                    estimatedDuration: "3 hours",
                    resources: [],
                    notes: "",
                },
            ],
            isCompleted: false,
            estimatedDuration: "15-20 hours",
        },
        {
            title: "Client-Side Routing with React Router DOM",
            order: 3,
            description:
                "Implement robust client-side routing to build multi-page applications and manage navigation effectively.",
            subtopics: [
                {
                    title: "Basic Routing: BrowserRouter, Routes, Route",
                    order: 1,
                    description:
                        "Set up fundamental routing for your application, defining paths and associating them with components.",
                    isCompleted: false,
                    estimatedDuration: "2 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Nested Routes and Dynamic Segments",
                    order: 2,
                    description:
                        "Create complex routing structures with nested routes and handle dynamic URL parameters for specific data fetching.",
                    isCompleted: false,
                    estimatedDuration: "3 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Programmatic Navigation and URL Parameters",
                    order: 3,
                    description:
                        "Learn to navigate programmatically using `useNavigate` and extract URL parameters with `useParams`.",
                    isCompleted: false,
                    estimatedDuration: "2 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Protected Routes and Authentication Flow",
                    order: 4,
                    description:
                        "Implement route guards to protect authenticated routes and manage user access based on login status.",
                    isCompleted: false,
                    estimatedDuration: "3 hours",
                    resources: [],
                    notes: "",
                },
            ],
            isCompleted: false,
            estimatedDuration: "8-10 hours",
        },
        {
            title: "Data Fetching and Caching Strategies",
            order: 4,
            description:
                "Master modern techniques for fetching, updating, and caching data in React applications for improved UX and performance.",
            subtopics: [
                {
                    title: "Traditional Data Fetching with useEffect and Axios/Fetch",
                    order: 1,
                    description:
                        "Revisit basic data fetching patterns using `useEffect` with `fetch` or Axios, handling loading and error states.",
                    isCompleted: false,
                    estimatedDuration: "3 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Introduction to React Query (TanStack Query) or SWR",
                    order: 2,
                    description:
                        "Explore dedicated data fetching libraries that provide powerful caching, revalidation, and synchronization features.",
                    isCompleted: false,
                    estimatedDuration: "4 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Query Invalidation, Mutations, and Optimistic Updates",
                    order: 3,
                    description:
                        "Learn to manage data mutations, invalidate cache, and implement optimistic UI updates for a snappier user experience.",
                    isCompleted: false,
                    estimatedDuration: "5 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Handling Pagination, Infinite Scroll, and Dependent Queries",
                    order: 4,
                    description:
                        "Implement advanced data fetching patterns for displaying large datasets and handling sequential API calls.",
                    isCompleted: false,
                    estimatedDuration: "3 hours",
                    resources: [],
                    notes: "",
                },
            ],
            isCompleted: false,
            estimatedDuration: "12-15 hours",
        },
        {
            title: "Performance Optimization Techniques",
            order: 5,
            description:
                "Identify and resolve performance bottlenecks in React applications to ensure a fast and smooth user experience.",
            subtopics: [
                {
                    title: "Identifying Re-renders with React Dev Tools Profiler",
                    order: 1,
                    description:
                        "Use the React Dev Tools Profiler to visualize component render cycles and pinpoint performance issues.",
                    isCompleted: false,
                    estimatedDuration: "2 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Leveraging Memoization (React.memo, useCallback, useMemo)",
                    order: 2,
                    description:
                        "Apply memoization techniques effectively to prevent unnecessary re-renders of components and recalculations of values/functions.",
                    isCompleted: false,
                    estimatedDuration: "3 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Code Splitting with React.lazy and Suspense",
                    order: 3,
                    description:
                        "Implement code splitting at the component level to reduce initial bundle size and improve load times.",
                    isCompleted: false,
                    estimatedDuration: "3 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Virtualization for Large Lists (e.g., react-window)",
                    order: 4,
                    description:
                        "Optimize rendering of large lists by only rendering visible items, significantly improving performance for data-heavy UIs.",
                    isCompleted: false,
                    estimatedDuration: "4 hours",
                    resources: [],
                    notes: "",
                },
            ],
            isCompleted: false,
            estimatedDuration: "10-12 hours",
        },
        {
            title: "Advanced Component Patterns & Reusability",
            order: 6,
            description:
                "Explore advanced patterns to build flexible, maintainable, and highly reusable React components.",
            subtopics: [
                {
                    title: "Compound Components Pattern",
                    order: 1,
                    description:
                        "Design components that work together implicitly to share state and logic, offering a flexible API to users.",
                    isCompleted: false,
                    estimatedDuration: "3 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Render Props Pattern",
                    order: 2,
                    description:
                        "Use the render props pattern to share code between components using a prop whose value is a function.",
                    isCompleted: false,
                    estimatedDuration: "2 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Higher-Order Components (HOCs)",
                    order: 3,
                    description:
                        "Understand HOCs for reusing component logic and their role, as well as when to prefer hooks or render props.",
                    isCompleted: false,
                    estimatedDuration: "3 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Controlled vs. Uncontrolled Components Deep Dive",
                    order: 4,
                    description:
                        "Master the differences between controlled and uncontrolled components, and when to use each for form inputs.",
                    isCompleted: false,
                    estimatedDuration: "2 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Prop Collections and Prop Getters",
                    order: 5,
                    description:
                        "Learn to create flexible APIs for components by providing collections of props or functions that return props.",
                    isCompleted: false,
                    estimatedDuration: "2 hours",
                    resources: [],
                    notes: "",
                },
            ],
            isCompleted: false,
            estimatedDuration: "10-12 hours",
        },
        {
            title: "Testing React Applications with React Testing Library",
            order: 7,
            description:
                "Learn to write effective and maintainable tests for your React components and custom hooks using Jest and React Testing Library.",
            subtopics: [
                {
                    title: "Introduction to Jest and React Testing Library",
                    order: 1,
                    description:
                        "Set up your testing environment and understand the philosophy behind React Testing Library (user-centric testing.",
                    isCompleted: false,
                    estimatedDuration: "2 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Unit Testing Components (Rendering, Events, State)",
                    order: 2,
                    description:
                        "Write tests to verify component rendering, user interactions, and internal state changes.",
                    isCompleted: false,
                    estimatedDuration: "3 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Testing Custom Hooks",
                    order: 3,
                    description:
                        "Learn techniques for isolating and testing the logic encapsulated within custom React hooks.",
                    isCompleted: false,
                    estimatedDuration: "2 hours",
                    resources: [],
                    notes: "",
                },
                {
                    title: "Mocking API Calls and Dependencies",
                    order: 4,
                    description:
                        "Master mocking external dependencies like API calls and other modules to ensure isolated and reliable tests.",
                    isCompleted: false,
                    estimatedDuration: "3 hours",
                    resources: [],
                    notes: "",
                },
            ],
            isCompleted: false,
            estimatedDuration: "8-10 hours",
        },
    ],
};

const roadmapSchema = new mongoose.Schema({}, { strict: false });
const RoadmapFlat = mongoose.model('RoadmapFlat', roadmapSchema);

async function seed() {
    console.log('Connecting to MongoDB at:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI);

    try {
        const existing = await RoadmapFlat.findById(roadmapData._id);
        if (existing) {
            console.log('Roadmap already exists, updating...');
            await RoadmapFlat.findByIdAndUpdate(roadmapData._id, roadmapData);
        } else {
            console.log('Creating new roadmap...');
            await RoadmapFlat.create(roadmapData);
        }
        console.log('Seeding complete!');
    } catch (error) {
        console.error('Seeding failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

seed();
