/**
 * OpenAPI to JSON Documentation Converter
 *
 * Converts OpenAPI/Swagger YAML or JSON specification to a simplified
 * JSON format optimized for the Masukkan Nama API documentation website.
 *
 * Usage:
 *   node scripts/generate-docs.js [input-file] [output-file]
 *
 * If no arguments provided, uses default paths:
 *   Input:  openapi.yaml in the project root
 *   Output: src/data/docs.json
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Default paths
const DEFAULT_INPUT = path.join(__dirname, '..', 'openapi.yaml')
const DEFAULT_OUTPUT = path.join(__dirname, '..', 'src', 'data', 'docs.json')

/**
 * Parse OpenAPI YAML/JSON file
 */
function parseOpenAPI(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')

  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
    // Simple YAML parser for basic structures
    return parseYAML(content)
  } else if (filePath.endsWith('.json')) {
    return JSON.parse(content)
  } else {
    throw new Error(`Unsupported file format: ${filePath}`)
  }
}

/**
 * Simple YAML parser for OpenAPI spec
 */
function parseYAML(content) {
  const lines = content.split('\n')
  const result = {}
  const stack = [{ obj: result, indent: -1 }]

  for (const line of lines) {
    const trimmed = line.trim()

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue

    const indent = line.search(/\S/)
    const isArrayItem = trimmed.startsWith('- ')

    // Pop stack for lower indentation
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop()
    }

    const current = stack[stack.length - 1].obj

    if (isArrayItem) {
      const value = trimmed.substring(2).trim()
      if (!Array.isArray(current)) {
        current.push(value)
      }
      continue
    }

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue

    const key = trimmed.substring(0, colonIndex).trim()
    let value = trimmed.substring(colonIndex + 1).trim()

    // Remove trailing comment
    const commentIndex = value.indexOf(' #')
    if (commentIndex !== -1) {
      value = value.substring(0, commentIndex).trim()
    }

    if (value === '' || value === '|' || value === '>') {
      // Nested object or array
      current[key] = {}
      stack.push({ obj: current[key], indent })
    } else if (value === '[]') {
      current[key] = []
    } else if (value === '{}') {
      current[key] = {}
    } else if (value.startsWith('"') && value.endsWith('"')) {
      current[key] = value.slice(1, -1)
    } else if (value.startsWith("'") && value.endsWith("'")) {
      current[key] = value.slice(1, -1)
    } else if (value === 'true') {
      current[key] = true
    } else if (value === 'false') {
      current[key] = false
    } else if (value === 'null') {
      current[key] = null
    } else if (!isNaN(value)) {
      current[key] = Number(value)
    } else {
      current[key] = value
    }
  }

  return result
}

/**
 * Convert OpenAPI paths to our docs format
 */
function convertToDocs(openapi) {
  const categories = {}

  // Group paths by tags
  for (const [path, methods] of Object.entries(openapi.paths || {})) {
    for (const [method, operation] of Object.entries(methods)) {
      const tag = operation.tags?.[0] || 'Other'
      const categoryId = tag.toLowerCase().replace(/\s+/g, '-')

      if (!categories[categoryId]) {
        categories[categoryId] = {
          id: categoryId,
          title: tag,
          description: operation.summary || '',
          endpoints: [],
        }
      }

      // Extract parameters
      const parameters = []
      if (operation.parameters) {
        for (const param of operation.parameters) {
          parameters.push({
            name: param.name,
            type: param.schema?.type || 'string',
            required: param.required || false,
            description: param.description || '',
          })
        }
      }

      // Extract request body
      let exampleRequest = null
      if (operation.requestBody) {
        const content = operation.requestBody.content?.['application/json']
        if (content?.schema) {
          exampleRequest = generateExampleRequest(content.schema, parameters)
        }
      }

      // Generate example response
      const exampleResponse = operation.responses?.['200']?.content?.['application/json']?.schema
        ? generateExampleResponse(operation.responses['200'].content['application/json'].schema)
        : { success: true, message: "Request successful", data: {} }

      const endpoint = {
        id: `${method}-${path.replace(/\//g, '-').replace(/-/g, '')}`,
        name: operation.summary || operation.operationId || path.split('/').pop(),
        method: method.toUpperCase(),
        path: path,
        description: operation.description || operation.summary || '',
        parameters,
        exampleRequest,
        exampleResponse,
        rateLimit: {
          requests: '100',
          perPeriod: 'minute',
          description: 'Rate limit per IP address',
        },
        notes: operation.description ? [operation.description] : [],
      }

      categories[categoryId].endpoints.push(endpoint)
    }
  }

  return Object.values(categories)
}

/**
 * Generate example request from schema
 */
function generateExampleRequest(schema, parameters) {
  const example = {}

  // Add parameters as query/body
  for (const param of parameters) {
    if (param.type === 'string') {
      example[param.name] = 'value'
    } else if (param.type === 'integer' || param.type === 'number') {
      example[param.name] = 123
    } else if (param.type === 'boolean') {
      example[param.name] = true
    }
  }

  // Add schema properties
  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      example[key] = getExampleValue(prop)
    }
  }

  const curlParams = parameters
    .map((p) => `  -d "${p.name}=${example[p.name] || 'value'}"`)
    .join(' \\\n')

  return {
    tabs: [
      {
        id: 'curl',
        label: 'cURL',
        language: 'curl',
        code: `curl -X POST "https://api.masukkan-nama.com/v1/example" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"${curlParams ? ` \\\n${curlParams}` : ''}`,
      },
      {
        id: 'javascript',
        label: 'JavaScript',
        language: 'javascript',
        code: `const response = await fetch('https://api.masukkan-nama.com/v1/example', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(${JSON.stringify(example, null, 2).replace(/\n/g, '\n  ')})
});

const data = await response.json();`,
      },
      {
        id: 'python',
        label: 'Python',
        language: 'python',
        code: `import requests

response = requests.post(
  'https://api.masukkan-nama.com/v1/example',
  headers={
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  json=${JSON.stringify(example, null, 2).replace(/\n/g, '\n  ')}
)

data = response.json()`,
      },
    ],
  }
}

/**
 * Get example value from schema
 */
function getExampleValue(schema) {
  if (schema.example) return schema.example

  switch (schema.type) {
    case 'string':
      return schema.enum?.[0] || 'example'
    case 'integer':
    case 'number':
      return 123
    case 'boolean':
      return true
    case 'array':
      return [getExampleValue(schema.items)]
    case 'object':
      const obj = {}
      if (schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
          obj[key] = getExampleValue(prop)
        }
      }
      return obj
    default:
      return null
  }
}

/**
 * Generate example response from schema
 */
function generateExampleResponse(schema) {
  if (!schema) return { success: true, message: "OK" }

  const example = {
    success: true,
    message: "Request successful",
    data: {},
  }

  if (schema.$ref) {
    // Handle $ref - simplified
    const refName = schema.$ref.split('/').pop()
    example.data = { [refName.toLowerCase()]: {} }
  } else if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      example.data[key] = getExampleValue(prop)
    }
  }

  return example
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2)
  const inputPath = args[0] || DEFAULT_INPUT
  const outputPath = args[1] || DEFAULT_OUTPUT

  console.log('📄 OpenAPI to JSON Documentation Converter')
  console.log('='.repeat(50))

  // Check if input file exists
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Error: Input file not found: ${inputPath}`)
    console.log('\nGenerating example docs.json...')
    generateExampleDocs(outputPath)
    return
  }

  try {
    console.log(`📖 Reading: ${inputPath}`)
    const openapi = parseOpenAPI(inputPath)
    console.log(`✅ Parsed OpenAPI spec: ${openapi.info?.title || 'Unknown'} v${openapi.info?.version || '1.0.0'}`)

    console.log('\n🔄 Converting to docs format...')
    const docs = convertToDocs(openapi)
    console.log(`✅ Found ${docs.length} categories`)

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Write output
    fs.writeFileSync(outputPath, JSON.stringify(docs, null, 2))
    console.log(`\n✅ Output written to: ${outputPath}`)
    console.log(`📊 ${docs.reduce((acc, cat) => acc + cat.endpoints.length, 0)} total endpoints`)

  } catch (error) {
    console.error(`❌ Error: ${error.message}`)
    console.log('\nGenerating example docs.json...')
    generateExampleDocs(outputPath)
  }
}

/**
 * Generate example docs.json
 */
function generateExampleDocs(outputPath) {
  const exampleDocs = [
    {
      id: 'downloader',
      title: 'Downloader',
      description: 'Multi-platform media downloader API for videos, audio, and images.',
      endpoints: [
        {
          id: 'get-youtube',
          name: 'Download YouTube Video',
          method: 'GET',
          path: '/v1/downloader/youtube',
          description: 'Download YouTube video with merged audio+video format.',
          parameters: [
            { name: 'url', type: 'string', required: true, description: 'YouTube video URL' },
            { name: 'format', type: 'string', required: false, description: 'Video format (mp4, audio)' },
          ],
          exampleRequest: {
            tabs: [
              {
                id: 'curl',
                label: 'cURL',
                language: 'curl',
                code: `curl -X GET "https://api.masukkan-nama.com/v1/downloader/youtube?url=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3DOVGOkz3Slsc" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
              },
              {
                id: 'javascript',
                label: 'JavaScript',
                language: 'javascript',
                code: `const response = await fetch(
  'https://api.masukkan-nama.com/v1/downloader/youtube?url=https://youtube.com/watch?v=OVGOkz3Slsc',
  {
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY'
    }
  }
);

const data = await response.json();`,
              },
            ],
          },
          exampleResponse: {
            success: true,
            message: "Video fetched successfully",
            data: {
              title: "Video Title",
              uploader: "Channel Name",
              mediaItems: [
                {
                  type: "video",
                  url: "https://download.url/video.mp4",
                  extension: "mp4",
                  width: 1920,
                  height: 1080,
                }
              ]
            }
          },
          rateLimit: {
            requests: '50',
            perPeriod: 'minute',
            description: 'Limited by YouTube API'
          }
        },
        {
          id: 'post-tiktok',
          name: 'Download TikTok Video',
          method: 'POST',
          path: '/v1/downloader/tiktok',
          description: 'Download TikTok video without watermark.',
          parameters: [
            { name: 'url', type: 'string', required: true, description: 'TikTok video URL' },
          ],
          exampleRequest: {
            tabs: [
              {
                id: 'curl',
                label: 'cURL',
                language: 'curl',
                code: `curl -X POST "https://api.masukkan-nama.com/v1/downloader/tiktok" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://www.tiktok.com/@user/video/123"}'`,
              },
            ],
          },
          exampleResponse: {
            success: true,
            message: "Video fetched successfully",
            data: {
              title: "TikTok Video Description",
              uploader: "username",
              mediaItems: [
                {
                  type: "video",
                  url: "https://download.url/video.mp4",
                  extension: "mp4",
                }
              ]
            }
          },
        },
        {
          id: 'post-instagram',
          name: 'Download Instagram Media',
          method: 'POST',
          path: '/v1/downloader/instagram',
          description: 'Download Instagram posts, reels, and stories.',
          parameters: [
            { name: 'url', type: 'string', required: true, description: 'Instagram post/reel URL' },
          ],
          exampleRequest: {
            tabs: [
              {
                id: 'curl',
                label: 'cURL',
                language: 'curl',
                code: `curl -X POST "https://api.masukkan-nama.com/v1/downloader/instagram" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://www.instagram.com/p/abc123"}'`,
              },
            ],
          },
          exampleResponse: {
            success: true,
            data: {
              mediaItems: [
                { type: "photo", url: "...", extension: "jpg" },
                { type: "video", url: "...", extension: "mp4" }
              ]
            }
          },
        },
      ]
    },
    {
      id: 'tools',
      title: 'Tools',
      description: 'Useful utility tools for developers.',
      endpoints: [
        {
          id: 'get-shorten',
          name: 'URL Shortener',
          method: 'POST',
          path: '/v1/tools/shorten',
          description: 'Shorten a long URL into a compact link.',
          parameters: [
            { name: 'url', type: 'string', required: true, description: 'URL to shorten' },
            { name: 'custom', type: 'string', required: false, description: 'Custom alias (optional)' },
          ],
          exampleRequest: {
            tabs: [
              {
                id: 'curl',
                label: 'cURL',
                language: 'curl',
                code: `curl -X POST "https://api.masukkan-nama.com/v1/tools/shorten" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://very-long-url.com/page"}'`,
              },
            ],
          },
          exampleResponse: {
            success: true,
            data: {
              originalUrl: "https://very-long-url.com/page",
              shortUrl: "https://api.masukkan-nama.com/s/abc123",
              shortCode: "abc123",
            }
          },
        },
        {
          id: 'get-proxy',
          name: 'Proxy List',
          method: 'GET',
          path: '/v1/tools/proxy',
          description: 'Get a list of working proxy servers.',
          parameters: [
            { name: 'country', type: 'string', required: false, description: 'Filter by country code' },
            { name: 'limit', type: 'integer', required: false, description: 'Number of proxies to return' },
          ],
          exampleRequest: {
            tabs: [
              {
                id: 'curl',
                label: 'cURL',
                language: 'curl',
                code: `curl -X GET "https://api.masukkan-nama.com/v1/tools/proxy?country=US&limit=10" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
              },
            ],
          },
          exampleResponse: {
            success: true,
            data: {
              proxies: [
                { ip: "1.2.3.4", port: 8080, country: "US", protocol: "http" },
              ]
            }
          },
        },
      ]
    },
    {
      id: 'game',
      title: 'Game',
      description: 'Mini-games and entertainment APIs.',
      endpoints: [
        {
          id: 'get-random-meme',
          name: 'Random Meme',
          method: 'GET',
          path: '/v1/game/meme',
          description: 'Get a random meme from various sources.',
          parameters: [],
          exampleRequest: {
            tabs: [
              {
                id: 'curl',
                label: 'cURL',
                language: 'curl',
                code: `curl -X GET "https://api.masukkan-nama.com/v1/game/meme" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
              },
            ],
          },
          exampleResponse: {
            success: true,
            data: {
              title: "Meme Title",
              imageUrl: "https://example.com/meme.jpg",
              source: "reddit",
            }
          },
        },
      ]
    },
    {
      id: 'search',
      title: 'Search',
      description: 'Search APIs for finding content.',
      endpoints: [
        {
          id: 'get-lyrics',
          name: 'Search Lyrics',
          method: 'GET',
          path: '/v1/search/lyrics',
          description: 'Search for song lyrics.',
          parameters: [
            { name: 'q', type: 'string', required: true, description: 'Search query' },
            { name: 'limit', type: 'integer', required: false, description: 'Max results' },
          ],
          exampleRequest: {
            tabs: [
              {
                id: 'curl',
                label: 'cURL',
                language: 'curl',
                code: `curl -X GET "https://api.masukkan-nama.com/v1/search/lyrics?q=hello%20world" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
              },
            ],
          },
          exampleResponse: {
            success: true,
            data: {
              results: [
                { title: "Hello", artist: "Adele", lyrics: "..." },
              ]
            }
          },
        },
      ]
    },
    {
      id: 'stalk',
      title: 'Stalker',
      description: 'Social media information lookup APIs.',
      endpoints: [
        {
          id: 'get-tiktok-info',
          name: 'TikTok User Info',
          method: 'GET',
          path: '/v1/stalk/tiktok',
          description: 'Get TikTok user profile information.',
          parameters: [
            { name: 'username', type: 'string', required: true, description: 'TikTok username' },
          ],
          exampleRequest: {
            tabs: [
              {
                id: 'curl',
                label: 'cURL',
                language: 'curl',
                code: `curl -X GET "https://api.masukkan-nama.com/v1/stalk/tiktok?username=khaby.lame" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
              },
            ],
          },
          exampleResponse: {
            success: true,
            data: {
              username: "khaby.lame",
              displayName: "Khabane Lame",
              followers: "100M+",
              following: "100+",
              bio: "...",
              avatarUrl: "https://...",
            }
          },
        },
      ]
    },
  ]

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(outputPath, JSON.stringify(exampleDocs, null, 2))
  console.log(`✅ Example docs.json generated: ${outputPath}`)
  console.log(`📊 ${exampleDocs.reduce((acc, cat) => acc + cat.endpoints.length, 0)} total endpoints`)
}

// Run if called directly
main()
