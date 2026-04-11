import * as FileSystem from 'expo-file-system/legacy';

export async function extractTextFromImage(imageUri: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_CLOUD_VISION_API;
  if (!apiKey) {
    console.warn('Missing Google Vision API Key (EXPO_PUBLIC_CLOUD_VISION_API)');
    return '';
  }

  try {
    console.log(`[GoogleVision] Extracting text from image URI: ${imageUri.substring(0, 50)}...`);
    
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });

    const body = {
      requests: [
        {
          image: { content: base64 },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
        },
      ],
    };

    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    console.log(`[GoogleVision] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error(`Google Vision API Error: ${response.status} ${response.statusText}`, JSON.stringify(errorData, null, 2));
      return '';
    }

    const data = await response.json();
    
    if (data.responses && data.responses[0]) {
      const resp = data.responses[0];
      
      if (resp.error) {
        console.error(`[GoogleVision] API Error in response: ${JSON.stringify(resp.error)}`);
        return '';
      }
      
      // Utilizziamo le singole annotazioni per ricostruire le righe "fisiche" dello scontrino
      // Questo aiuta ad accoppiare Voci (sinistra) e Prezzi (destra)
      if (resp.textAnnotations && resp.textAnnotations.length > 1) {
        // Il primo elemento [0] è il riassunto completo, lo saltiamo
        const annotations = resp.textAnnotations.slice(1);
        
        // Ordiniamo per Y (riga) e poi per X (colonna)
        // Creiamo righe basate su una tolleranza di pixel verticali (es. 10px)
        const lines: { y: number, text: string, x: number }[][] = [];
        const Y_TOLERANCE = 10; 

        annotations.forEach((anno: any) => {
          const vertices = anno.boundingPoly.vertices;
          const y = vertices[0].y || 0;
          const x = vertices[0].x || 0;
          const text = anno.description;

          let added = false;
          for (let line of lines) {
            if (Math.abs(line[0].y - y) < Y_TOLERANCE) {
              line.push({ y, x, text });
              added = true;
              break;
            }
          }
          if (!added) {
            lines.push([{ y, x, text }]);
          }
        });

        // Ordiniamo le righe dall'alto in basso
        lines.sort((a, b) => a[0].y - b[0].y);

        // Ordiniamo ogni parola dentro la riga da sinistra a destra e uniamo
        const formattedText = lines.map(line => {
          return line.sort((a, b) => a.x - b.x).map(w => w.text).join(' ');
        }).join('\n');

        console.log(`[GoogleVision] Reconstructed Text (L-to-R):\n${formattedText.substring(0, 200)}...`);
        return formattedText;
      }

      if (resp.fullTextAnnotation) {
        return resp.fullTextAnnotation.text;
      }
    }

    console.log(`[GoogleVision] No text found in image. Full Response: ${JSON.stringify(data)}`);
    return '';
  } catch (error) {
    console.error('Error extracting text from image:', error);
    return '';
  }
}
