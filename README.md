# Personal Website

A clean, minimalist personal website built with vanilla HTML, CSS, and JavaScript. Designed for easy customization and hosting on GitHub Pages.

## Quick Start

1. Clone or download this repository
2. Edit the HTML files to add your content
3. Replace placeholder images in `assets/images/`
4. Deploy to GitHub Pages or your preferred host

## Project Structure

```
website/
├── index.html              # Homepage
├── 404.html                # Error page
├── .nojekyll               # Disable Jekyll processing
├── .gitignore              # Git ignore file
│
├── blog/
│   ├── index.html          # Blog listing page
│   └── posts/              # Individual blog posts
│
├── projects/
│   └── index.html          # Projects showcase
│
├── inspirations/
│   └── index.html          # Inspiration gallery
│
├── about/
│   └── index.html          # About page
│
├── assets/
│   ├── css/
│   │   ├── variables.css   # Design tokens (colors, spacing, fonts)
│   │   ├── reset.css       # Browser normalization
│   │   ├── base.css        # Typography and @font-face
│   │   ├── layout.css      # Grid, containers, header/footer
│   │   ├── components.css  # Buttons, cards, badges
│   │   ├── slider.css      # Slider/carousel styles
│   │   └── utilities.css   # Helper classes
│   │
│   ├── js/
│   │   ├── slider.js       # Slider component
│   │   ├── navigation.js   # Mobile nav toggle
│   │   └── main.js         # Site-wide functionality
│   │
│   ├── fonts/
│   │   └── svaerd/         # Svaerd font files (7 weights)
│   │
│   └── images/
│       ├── projects/       # Project images
│       ├── blog/           # Blog post images
│       └── inspirations/   # Gallery images
│
└── templates/
    ├── post-template.html    # Blog post template
    ├── project-template.html # Project case study template
    └── widget-card.html      # Card component reference
```

## Customization Guide

### Changing Colors

Edit `assets/css/variables.css` to customize the color scheme:

```css
:root {
  --color-primary: #1a1a1a;      /* Main dark color */
  --color-accent: #4a90d9;       /* Accent/link color */
  --color-bg-primary: #ffffff;   /* Background color */
  /* ... more colors */
}
```

### Typography

The site uses the **Svaerd** font family with 7 weights:
- Thin (100)
- ExtraLight (200)
- Light (300)
- Regular (400)
- Medium (500)
- SemiBold (600)
- Bold (700)

Font declarations are in `assets/css/base.css`. To use a different font:
1. Replace the font files in `assets/fonts/`
2. Update the `@font-face` declarations in `base.css`
3. Update `--font-family-primary` in `variables.css`

### Adding Content

#### Blog Posts
1. Copy `templates/post-template.html` to `blog/posts/`
2. Rename the file (e.g., `my-first-post.html`)
3. Edit the HTML, replacing placeholder content
4. Add a card linking to it on `blog/index.html`

#### Projects
1. Copy `templates/project-template.html` to create a project page
2. Edit the content and add your images
3. Add a card on `projects/index.html`

#### Widget Cards
Reference `templates/widget-card.html` for card component usage. Available variants:
- `default` - Standard card with border
- `featured` - Larger, prominent card
- `minimal` - Clean, no decorations
- `horizontal` - Side-by-side layout

### Slider Component

Add a slider to any page:

```html
<div class="slider" data-autoplay="true" data-interval="5000">
  <div class="slider__track">
    <div class="slider__slide">Slide 1</div>
    <div class="slider__slide">Slide 2</div>
    <div class="slider__slide">Slide 3</div>
  </div>
</div>
```

**Data attributes:**
- `data-autoplay` - Enable auto-sliding (`true`/`false`)
- `data-interval` - Time between slides in ms (default: 5000)
- `data-loop` - Enable infinite loop (default: `true`)
- `data-pause-on-hover` - Pause on mouse hover (default: `true`)

### Responsive Breakpoints

The site uses these breakpoints:
- **sm**: 640px (small tablets)
- **md**: 768px (tablets)
- **lg**: 1024px (laptops)
- **xl**: 1280px (desktops)
- **2xl**: 1536px (large desktops)

## Editing Tips

1. **Look for HTML comments** - Content sections are marked with comments like:
   ```html
   <!-- Edit: Your headline -->
   ```

2. **Replace placeholders** - Search for "Edit:" to find all customizable sections

3. **Update navigation** - If you add/remove pages, update the nav in:
   - The `<header>` section of each page
   - The mobile nav section

4. **Add images** - Replace the placeholder `<div>` elements with actual `<img>` tags

5. **SEO** - Update `<title>` and `<meta name="description">` on each page

## Deployment

### GitHub Pages

1. Push the code to a GitHub repository
2. Go to Settings > Pages
3. Select the branch to deploy (usually `main`)
4. Your site will be live at `https://username.github.io/repo-name/`

The `.nojekyll` file ensures GitHub doesn't process the site with Jekyll.

### Other Hosts

The site is static HTML/CSS/JS and can be deployed anywhere:
- Netlify
- Vercel
- Cloudflare Pages
- Any web server

## Browser Support

Tested and works in:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Credits

- Font: Svaerd
- Built with vanilla HTML, CSS, and JavaScript
- No build tools or dependencies required

## License

This template is provided for personal use. Feel free to customize it for your own website.
