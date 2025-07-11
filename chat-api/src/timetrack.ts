// src/timetrack.ts

import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import dotenv from 'dotenv';
import https from 'https';

dotenv.config();

const TIMETRACK_BASE_URL = 'https://rockchtagmbh.timetrackenterprise.com/api/v2/ext';
const APP_KEY = process.env.TIMETRACK_API_KEY;
const APP_SECRET = process.env.TIMETRACK_API_SECRET;

if (!APP_KEY || !APP_SECRET) {
    console.error("TimeTrack API Key or Secret not found in environment variables.");
    process.exit(1);
}

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

const timetrackAxios = axios.create({
    httpsAgent,
    baseURL: TIMETRACK_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'X-TimeTrack-Api-Secret': APP_SECRET,
        'X-TimeTrack-Api-Key': APP_KEY,
        'Accept': 'application/json, text/plain, */*',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
});

timetrackAxios.interceptors.request.use(config => {
    console.log('\n--- Axios Request Interceptor ---');
    console.log('Method:', config.method);
    console.log('URL:', config.url);
    console.log('Headers:', config.headers);
    console.log('Params:', config.params);
    console.log('Data:', config.data);
    console.log('--- End Axios Request Interceptor  ---\n');
    return config;
}, error => {
    return Promise.reject(error);
});


function getErrorMessage(error: unknown): string {
    if (error instanceof AxiosError) {
        console.error("Axios Error Response Status:", error.response?.status);
        console.error("Axios Error Response Data:", error.response?.data);
        return error.response?.data?.message || error.message;
    } else if (error instanceof Error) {
        return error.message;
    } else if (typeof error === 'string') {
        return error;
    }
    return "An unknown error occurred.";
}


// User interface (assuming this is still correct from /users endpoint)
interface User {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    // ... other user fields
}

// **** UPDATED ABSENCE INTERFACE based on your provided JSON ****
interface Absence {
    id: number;
    from: string; // Corrected field name
    to: string;   // Corrected field name
    absenceType: number;
    absenceTypeName: string; // Corrected field name
    status: number;
    user: string; // This seems to be username, not ID directly
    color: string;
    is_plannable: boolean;
    user_id: number; // Corrected field name (this is the ID we'll use for matching)
    day_segment: number;
    working_time_strategies: any[]; // Assuming array of any for now
}


export const fetchTimeTrackUsers = async (): Promise<User[]> => {
    try {
        const response = await timetrackAxios.get<User[]>('/users');
        return response.data;
    } catch (error: unknown) {
        console.error("Error fetching TimeTrack users:", getErrorMessage(error));
        throw new Error("Failed to fetch TimeTrack users.");
    }
};

export const fetchTimeTrackAbsences = async (params?: { startDate?: string; endDate?: string }): Promise<Absence[]> => {
    try {
        const response = await timetrackAxios.get<Absence[]>('/absences', {
            params: params,
        });
        return response.data;
    } catch (error: unknown) {
        console.error("Error fetching TimeTrack absences:", getErrorMessage(error));
        throw new Error("Failed to fetch TimeTrack absences.");
    }
};

export const fetchTimeTrackProjects = async (): Promise<any[]> => {
    try {
        const response = await timetrackAxios.get<any[]>('/projects');
        return response.data;
    } catch (error: unknown) {
        console.error("Error fetching TimeTrack projects:", getErrorMessage(error));
        throw new Error("Failed to fetch TimeTrack projects.");
    }
};


export const fetchCurrentAbsences = async (): Promise<string> => {
    try {
        const now = new Date();
        const today = now.toISOString().split('T')[0]; // e.g., '2025-07-11'

        // Get tomorrow's date for an inclusive range, as TimeTrack API 'to' date might be exclusive
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        const tomorrowString = tomorrow.toISOString().split('T')[0];

        // Fetch absences for the relevant date range
        const absences = await fetchTimeTrackAbsences({ startDate: today, endDate: tomorrowString });
        const users = await fetchTimeTrackUsers();

        if (absences.length === 0) {
            return "No one is currently absent or on leave today.";
        }

        let response = "Today's absences:\n";
        absences.forEach(absence => {
            // Match absence.user_id with user.id
            const user = users.find(u => u.id === absence.user_id);

            if (user) {
                response += `- ${user.firstName} ${user.lastName} is on ${absence.absenceTypeName} from ${new Date(absence.from).toLocaleDateString('de-DE')} to ${new Date(absence.to).toLocaleDateString('de-DE')}.\n`;
            } else {
                // Fallback for when a user isn't found for an absence ID
                response += `- User ID ${absence.user_id} (Username: ${absence.user}) is on ${absence.absenceTypeName} from ${new Date(absence.from).toLocaleDateString('de-DE')} to ${new Date(absence.to).toLocaleDateString('de-DE')}.\n`;
            }
        });

        return response;

    } catch (error) {
        console.error("Error fetching current absences:", getErrorMessage(error));
        return "Sorry, I couldn't retrieve absence information at the moment.";
    }
};

export const fetchProjectInfo = async (projectName?: string): Promise<string> => {
    try {
        const projects = await fetchTimeTrackProjects();

        if (!projects || projects.length === 0) {
            return "Sorry, I couldn't find any project information.";
        }

        if (projectName) {
            const project = projects.find(p => p.name.toLowerCase().includes(projectName.toLowerCase()));
            if (project) {
                return `Details for project "${project.name}": ID ${project.id}. (More details if available from API)`;
            } else {
                return `Sorry, I couldn't find a project named "${projectName}".`;
            }
        } else {
            const projectNames = projects.map(p => p.name).join(', ');
            return `Available projects: ${projectNames}. You can ask about a specific one.`;
        }

    } catch (error) {
        console.error("Error fetching project info:", getErrorMessage(error));
        return "Sorry, I couldn't retrieve project information at the moment.";
    }
};