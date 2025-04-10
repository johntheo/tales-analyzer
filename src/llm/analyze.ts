import OpenAI from 'openai';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

const openai = new OpenAI({ apiKey: config.openaiApiKey });

interface AnalyzeInput {
  textContent: string;
  images: string[];
  structuredContent: any;
}

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

// Função para extrair JSON de uma string que pode conter texto adicional
function extractJSON(text: string): any {
  try {
    // Tenta primeiro analisar a string inteira como JSON
    return JSON.parse(text);
  } catch (e) {
    // Se falhar, tenta encontrar um objeto JSON na string
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

export async function analyzePortfolio({ textContent, images, structuredContent }: AnalyzeInput): Promise<PortfolioAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  const prompt = `
You are an experienced mentor and coach specializing in design, product management, and portfolio development. You have years of experience helping professionals refine their portfolios and presentations to effectively showcase their work.

Your task is to provide detailed, constructive feedback on the material provided. This material has been extracted into structured text, images, and structured content.

Start by identifying the language of the content. Provide feedback in the same language, or use English if unsure.

IMPORTANT: Your feedback should be in a warm, supportive, mentor-to-mentee tone. As if you're sitting down with the person and having a thoughtful conversation about their work. Be specific, detailed, and actionable in your feedback. Point out strengths and areas for improvement with concrete examples and suggestions.

CRITICAL INSTRUCTIONS:
1. Each area's feedback must be completely independent and self-contained. Do not use transitional phrases like "Lastly," "Additionally," or "Furthermore" that suggest you're continuing from a previous point.
2. For the references section, provide REAL, SPECIFIC resources that would be genuinely helpful for the person based on their portfolio. Include actual titles, summaries, and links to real videos, podcasts, articles, decks, and books that are relevant to their work and would help them improve specific aspects of their portfolio.
3. You will be using a framework with 5 key areas to evaluate the portfolio: Clarity, Technical Skills, Innovation, User Focus, and Storytelling. For each area, you must provide a score from 1 to 10 and detailed feedback.

SCORING GUIDELINES:
- 1-3: Needs significant improvement
- 4-6: Average performance with room for improvement
- 7-8: Good performance with some areas to enhance
- 9-10: Excellent performance with minor refinements possible

TEXTS:
${textContent.slice(0, 8000)} 

IMAGES:
${images.slice(0, 10).join('\n')}

STRUCTURED CONTENT:
${JSON.stringify(structuredContent, null, 2)}

Your response must follow **strictly** the JSON schema below:
{
  "summary": "A comprehensive analysis of the portfolio in 2-3 paragraphs, written in a warm, mentor-like tone. Address the person directly and provide an overview of their work, strengths, and potential areas for growth. Include their overall score (average of all 5 areas) and what that means for their portfolio.",
  "areas": {
    "clarity": {
      "score": "A number from 1 to 10 representing the quality of their clarity in design and communication",
      "feedback": "Detailed feedback (3-4 paragraphs) on clarity, which is the cornerstone of effective design. Evaluate how well they communicate their intended message effortlessly, reduce cognitive load, and enhance user experience. Analyze their choices in layout, typography, color, and imagery to guide attention and facilitate comprehension. This feedback must be completely independent and self-contained."
    },
    "technical_skills": {
      "score": "A number from 1 to 10 representing the quality of their technical proficiency and mastery of design tools",
      "feedback": "Detailed feedback (3-4 paragraphs) on technical skills, which enable designers to bring creative visions to life with precision and efficiency. Evaluate their mastery of design tools and software, ability to execute complex ideas, and adaptability to new technologies. Analyze how effectively they leverage advanced features and techniques to enhance creativity and productivity. This feedback must be completely independent and self-contained."
    },
    "innovation": {
      "score": "A number from 1 to 10 representing the quality of their innovative thinking and approach",
      "feedback": "Detailed feedback (3-4 paragraphs) on innovation, which propels design beyond the ordinary. Evaluate how well they introduce fresh perspectives and solutions, take risks, experiment, and challenge conventional thinking. Analyze their ability to push boundaries and contribute novel approaches to the design field. This feedback must be completely independent and self-contained."
    },
    "user_focus": {
      "score": "A number from 1 to 10 representing the quality of their user-centered design approach",
      "feedback": "Detailed feedback (3-4 paragraphs) on user focus, which is fundamental to creating products that are functional, accessible, and resonate with the intended audience. Evaluate their understanding of user needs and behaviors, empathy, accessibility considerations, and relentless focus on user experience. Analyze how well they ensure designs are not only aesthetically pleasing but also intuitive and inclusive. This feedback must be completely independent and self-contained."
    },
    "storytelling": {
      "score": "A number from 1 to 10 representing the quality of their storytelling and narrative",
      "feedback": "Detailed feedback (3-4 paragraphs) on storytelling, which connects designs to emotions and creates meaningful experiences. Evaluate how well they captivate the audience, provide context and depth, and convey complex ideas simply. Analyze their ability to elevate design from functional to inspirational through effective narratives. This feedback must be completely independent and self-contained."
    }
  },
  "references": {
    "videos": [
      {
        "title": "Title of a REAL video that would help improve their portfolio",
        "summary": "One-sentence summary of what this video covers and why it's relevant to their work",
        "image": "Link to a thumbnail image for this video",
        "link": "https://actual-link-to-the-video.com"
      }
    ],
    "podcasts": [
      {
        "title": "Title of a REAL podcast episode that would help improve their portfolio",
        "summary": "One-sentence summary of what this podcast covers and why it's relevant to their work",
        "image": "Link to a thumbnail image for this podcast",
        "link": "https://actual-link-to-the-podcast.com"
      }
    ],
    "articles": [
      {
        "title": "Title of a REAL article that would help improve their portfolio",
        "summary": "One-sentence summary of what this article covers and why it's relevant to their work",
        "image": "Link to a thumbnail image for this article",
        "link": "https://actual-link-to-the-article.com"
      }
    ],
    "decks": [
      {
        "title": "Title of a REAL presentation deck that would help improve their portfolio",
        "summary": "One-sentence summary of what this deck covers and why it's relevant to their work",
        "image": "Link to a thumbnail image for this deck",
        "link": "https://actual-link-to-the-deck.com"
      }
    ],
    "books": [
      {
        "title": "Title of a REAL book that would help improve their portfolio",
        "summary": "One-sentence summary of what this book covers and why it's relevant to their work",
        "image": "Link to a thumbnail image for this book",
        "link": "https://actual-link-to-the-book.com"
      }
    ]
  }
}

IMPORTANT: For the references section, provide at least 3-5 REAL resources in each category that are specifically relevant to the person's portfolio and would help them improve. These should be actual, existing resources with real titles, summaries, and working links. Check the links before providing them.

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

    const analysis = extractJSON(content) as PortfolioAnalysis;
    
    // Validate the response structure
    if (!analysis.summary || 
        !analysis.areas || 
        !analysis.areas.clarity || 
        !analysis.areas.technical_skills || 
        !analysis.areas.innovation || 
        !analysis.areas.user_focus || 
        !analysis.areas.storytelling || 
        !analysis.references) {
      throw new Error('Invalid response structure from OpenAI');
    }

    return analysis;
  } catch (error) {
    logger.error('Analysis error', { error });
    throw new Error(`Failed to analyze portfolio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}