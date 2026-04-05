# Masukkan Nama API Documentation

Clean, fast, and developer-friendly API documentation website for Masukkan Nama API services.

## Features

- **Modern UI** - Built with React + Tailwind CSS for a clean, responsive design
- **Dark Mode** - Easy on the eyes with automatic dark mode support
- **Searchable Docs** - Quickly find endpoints with the built-in search
- **Code Examples** - Copy-to-clipboard code blocks in multiple languages
- **Mobile Responsive** - Fully functional on all device sizes
- **Fast Performance** - Powered by Vite for instant page loads

## Tech Stack

- [React](https://reactjs.org/) - UI library
- [Vite](https://vitejs.dev/) - Build tool
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [React Router](https://reactrouter.com/) - Client-side routing
- [Lucide React](https://lucide.dev/) - Beautiful icons

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18 or higher
- npm or yarn

### Installation

```bash
# Navigate to website directory
cd website

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at `http://localhost:3000`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory, ready for deployment.

## Project Structure

```
website/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.jsx           # Entry point
│   ├── App.jsx            # Router setup
│   ├── index.css          # Global styles & Tailwind
│   ├── components/
│   │   ├── Header.jsx     # Navigation bar
│   │   ├── Hero.jsx       # Landing hero section
│   │   ├── Footer.jsx     # Site footer
│   │   ├── DocsSidebar.jsx # Docs navigation sidebar
│   │   ├── DocsContent.jsx # Endpoint documentation
│   │   └── CodeBlock.jsx  # Code display component
│   ├── pages/
│   │   ├── Home.jsx       # Landing page
│   │   └── Docs.jsx       # Documentation page
│   └── data/
│       └── docs.json      # API documentation data
└── scripts/
    └── generate-docs.js   # OpenAPI to JSON converter
```

## Customization

### Adding New Endpoints

Edit `src/data/docs.json` to add new API endpoints:

```json
{
  "id": "category-id",
  "title": "Category Name",
  "description": "Category description",
  "endpoints": [
    {
      "id": "endpoint-id",
      "name": "Endpoint Name",
      "method": "GET",
      "path": "/v1/endpoint/path",
      "description": "Endpoint description",
      "parameters": [
        { "name": "paramName", "type": "string", "required": true, "description": "Param description" }
      ],
      "exampleRequest": {
        "tabs": [
          { "id": "curl", "label": "cURL", "language": "curl", "code": "..." }
        ]
      },
      "exampleResponse": {
        "success": true,
        "data": { ... }
      }
    }
  ]
}
```

### Theme Colors

Edit `tailwind.config.js` to customize colors:

```js
colors: {
  primary: {
    500: '#0ea5e9',  // Main brand color
    // ...
  },
  accent: {
    500: '#06b6d4',  // Secondary color
    // ...
  }
}
```

## Deployment

### Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel --prod`

### Netlify

1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set output directory: `dist`

### GitHub Pages

```bash
npm run build
# Upload dist/ folder to gh-pages branch
```

## Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run generate-docs  # Convert OpenAPI spec to JSON
```

## License

MIT License
