import OpenAI from 'openai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

interface PortfolioAnalysis {
  summary: string;
  areas: {
    clarity: {
      score: number;
      feedback: string;
    };
    technical_skills: {
      score: number;
      feedback: string;
    };
    innovation: {
      score: number;
      feedback: string;
    };
    user_focus: {
      score: number;
      feedback: string;
    };
    storytelling: {
      score: number;
      feedback: string;
    };
  };
  references: {
    videos: Array<{
      title: string;
      summary: string;
      image: string;
      link: string;
    }>;
    podcasts: Array<{
      title: string;
      summary: string;
      image: string;
      link: string;
    }>;
    articles: Array<{
      title: string;
      summary: string;
      image: string;
      link: string;
    }>;
    decks: Array<{
      title: string;
      summary: string;
      image: string;
      link: string;
    }>;
    books: Array<{
      title: string;
      summary: string;
      image: string;
      link: string;
    }>;
  };
}

// Function to extract JSON from a string that may contain additional text
function extractJSON(text: string): any {
  try {
    // First try to parse the entire string as JSON
    return JSON.parse(text);
  } catch (e) {
    // If it fails, try to find a JSON object in the string
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        throw new Error('Could not extract valid JSON from response');
      }
    }
    throw new Error('No JSON object found in response');
  }
}

export async function enrichWithReferences(analysis: PortfolioAnalysis): Promise<PortfolioAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  const prompt = `
You are an experienced mentor and coach specializing in design, product management, and portfolio development. You have years of experience helping professionals refine their portfolios and presentations to effectively showcase their work.

Your task is to enrich the portfolio analysis with relevant references and resources that would help the person improve their portfolio based on the feedback provided.

PORTFOLIO ANALYSIS:
${JSON.stringify(analysis, null, 2)}

IMPORTANT: For the references section, provide at least 3-5 REAL resources in each category that are specifically relevant to the person's portfolio and would help them improve. These should be actual, existing resources with real titles, summaries, and working links. Check the links before providing them.

Your response must follow **strictly** the JSON schema below, containing ONLY the references section:
{
  "references": {
    "videos": [
      {
        "title": "Title of the video",
        "summary": "Brief summary of the video content",
        "image": "URL to the video thumbnail",
        "link": "URL to the video"
      }
    ],
    "podcasts": [
      {
        "title": "Title of the podcast",
        "summary": "Brief summary of the podcast content",
        "image": "URL to the podcast cover",
        "link": "URL to the podcast"
      }
    ],
    "articles": [
      {
        "title": "Title of the article",
        "summary": "Brief summary of the article content",
        "image": "URL to the article image",
        "link": "URL to the article"
      }
    ],
    "decks": [
      {
        "title": "Title of the presentation",
        "summary": "Brief summary of the presentation content",
        "image": "URL to the presentation cover",
        "link": "URL to the presentation"
      }
    ],
    "books": [
      {
        "title": "Title of the book",
        "summary": "Brief summary of the book content",
        "image": "URL to the book cover",
        "link": "URL to the book"
      }
    ]
  }
}

DON'T include any additional text before or after the JSON.
`;

  try {
    logger.debug('Making OpenAI API call');
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    });
    logger.debug('OpenAI API call completed');

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    const referencesData = extractJSON(content);
    
    // Validate the response structure
    if (!referencesData.references) {
      throw new Error('Invalid response structure from OpenAI');
    }

    // Create a new analysis object with the enriched references
    const enrichedAnalysis: PortfolioAnalysis = {
      ...analysis,
      references: referencesData.references
    };

    return enrichedAnalysis;
  } catch (error) {
    logger.error('Reference enrichment error', { error });
    throw new Error(`Failed to enrich portfolio with references: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 