import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";

export const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generateImage = async () => {
    if (!prompt) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
        },
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          setImageUrl(`data:image/png;base64,${part.inlineData.data}`);
          break;
        }
      }
    } catch (error) {
      console.error('Error generating image:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="p-4 bg-white rounded-xl shadow-sm">
      <h2 className="text-lg font-bold mb-4">AI Image Generator</h2>
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Enter prompt for image..."
        className="w-full p-2 border rounded-lg mb-2"
      />
      <button
        onClick={generateImage}
        disabled={loading}
        className="w-full bg-blue-600 text-white p-2 rounded-lg font-semibold"
      >
        {loading ? 'Generating...' : 'Generate Image'}
      </button>
      {imageUrl && <img src={imageUrl} alt="Generated" className="mt-4 w-full rounded-lg" referrerPolicy="no-referrer" />}
    </section>
  );
};
