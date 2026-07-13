export interface UseCaseStep {
  title: string;
  description: string;
}

export interface UseCaseBenefit {
  icon: string;
  title: string;
  description: string;
}

export interface UseCaseFaq {
  question: string;
  answer: string;
}

export interface UseCase {
  /** URL slug: /ai/<slug> */
  slug: string;
  /** Lucide icon name (i-lucide-<icon>) */
  icon: string;
  /** Short label for cards/nav */
  label: string;
  /** Small eyebrow badge above the H1 */
  badge: string;
  /** Page H1 */
  heading: string;
  /** Sub-heading under the H1 */
  tagline: string;
  /** <title> tag */
  metaTitle: string;
  /** meta description */
  metaDescription: string;
  /**
   * Optional absolute (or root-relative) URL for a dedicated social/OG image.
   * When omitted, the page falls back to its first example image, then to the
   * site-wide default OG image.
   */
  ogImage?: string;
  /** Intro paragraph shown under the hero */
  intro: string;
  /** Prompt pre-filled when the visitor clicks the primary CTA */
  heroPrompt: string;
  /** Explore tag used to surface real community examples */
  exampleTag: string;
  benefits: UseCaseBenefit[];
  faqs: UseCaseFaq[];
}

/**
 * Standard 3-step flow — the product works the same way for every tool, so a
 * shared set of steps is intentional. Uniqueness for SEO comes from the
 * heading, intro, benefits, FAQs and live examples of each page.
 */
export const USE_CASE_STEPS: UseCaseStep[] = [
  {
    title: "Describe what you want",
    description:
      "Type a prompt (or upload a photo to edit). Not sure what to write? Use the built-in prompt library or polish your idea with one click.",
  },
  {
    title: "Pick a model & ratio",
    description:
      "Choose from the world's best AI image models and select an aspect ratio that fits where you'll use the result.",
  },
  {
    title: "Generate & download",
    description:
      "Get a high-quality image in seconds. Refine it with follow-up edits, save it to a collection, or download it instantly.",
  },
];

export const USE_CASES: UseCase[] = [
  {
    slug: "ai-headshot-generator",
    icon: "id-card",
    label: "AI Headshots",
    badge: "AI Headshot Generator",
    heading: "AI Headshot Generator",
    tagline:
      "Turn any selfie into a polished, professional headshot in seconds — no photographer required.",
    metaTitle: "AI Headshot Generator — Professional Photos in Seconds | Lumiar",
    metaDescription:
      "Create professional AI headshots from a simple selfie. Perfect for LinkedIn, resumes and team pages. Try Lumiar's AI headshot generator free.",
    intro:
      "Great headshots used to mean booking a studio and waiting days for edits. With Lumiar you upload a photo, describe the look you want — studio lighting, business attire, clean background — and get a sharp, professional headshot in seconds. Ideal for LinkedIn profiles, resumes, speaker bios and company team pages.",
    heroPrompt:
      "Professional studio headshot for a LinkedIn profile. Camera: Hasselblad H6D-100c with a 80mm f/2.8 HC Lens, shot at [aperture] for full facial sharpness. Lighting: three-point setup – key light is a Large Rectangular Softbox (60x90cm) placed [key_light_position]; fill light is a [fill_light]; hair light is [hair_light] from behind and above. Background: Seamless Mid-Grey Paper, evenly lit with Natural Window Spill. Subject: the reference image, looking Slightly Off-Camera With A Confident, Approachable Smile. Editing: Frequency Separation For Skin Texture, [face_enhancement], eye sharpening and iris brightening, teeth whitening, background neutralised to [background_color], final colour grade with Slight Teal-Orange Curve and [black_point_style].",
    exampleTag: "portrait",
    benefits: [
      {
        icon: "camera",
        title: "Studio-quality results",
        description:
          "Flattering lighting, clean backgrounds and realistic detail that look like they came from a professional shoot.",
      },
      {
        icon: "shirt",
        title: "Any style you need",
        description:
          "Corporate, creative, casual or editorial — describe the vibe and wardrobe and get a matching look.",
      },
      {
        icon: "zap",
        title: "Ready in seconds",
        description:
          "Skip the studio booking and week-long turnaround. Generate, tweak and download the same minute.",
      },
    ],
    faqs: [
      {
        question: "How do I make an AI headshot?",
        answer:
          "Upload one clear, well-lit photo of your face — ideally front-facing with an even background. Then describe the look you want: the attire (suit, smart-casual, creative), the background color and the lighting mood. Generate, and you'll have a polished headshot in seconds. If something's off, use a follow-up edit like \"brighten the background\" or \"soften the smile\" to refine it without starting over.",
      },
      {
        question: "Are AI headshots good enough for LinkedIn and resumes?",
        answer:
          "Yes. Lumiar uses top-tier image models that deliver sharp, natural-looking headshots with realistic skin texture and flattering studio lighting — the quality expected on LinkedIn, resumes, company team pages, speaker bios and press kits. You can export at high resolution, ready to upload anywhere.",
      },
      {
        question: "Will the headshot still look like me?",
        answer:
          "When you provide a clear reference photo, the result keeps your likeness — your features, proportions and expression — while upgrading the lighting, background and overall polish. For the closest resemblance, use a recent, front-facing photo where your face is clearly visible and not heavily shadowed.",
      },
      {
        question: "Do I need any photography or editing experience?",
        answer:
          "None at all. There's no camera, studio or retouching skill required — just describe what you want in plain language (or start from a ready-made prompt) and the AI handles the lighting, composition and retouching for you.",
      },
    ],
  },
  {
    slug: "restore-old-photos",
    icon: "image-up",
    label: "Restore Photos",
    badge: "AI Photo Restoration",
    heading: "Restore Old Photos with AI",
    tagline:
      "Bring faded, scratched and damaged family photos back to life — clearer and sharper than the original.",
    metaTitle: "Restore Old Photos with AI — Repair & Enhance | Lumiar",
    metaDescription:
      "Repair scratches, fix fading and enhance detail in old family photos with AI. Restore precious memories in seconds with Lumiar.",
    intro:
      "Old prints fade, crack and lose detail over time. Lumiar's AI photo restoration rebuilds damaged areas, removes scratches and dust, and sharpens faces so your most precious memories look crisp again. Upload a scan of an old photo, describe what to fix, and download a restored version to reprint or share with family.",
    heroPrompt: `Restore this old photograph with a focus on authenticity.

Restoration tasks:

Remove scratches, dust, stains, tears, and other physical damage.
Repair missing or damaged areas while preserving the original composition.
Reduce noise and film grain only where necessary.
Correct fading, restore contrast, and balance exposure.
Improve sharpness and recover fine facial details (eyes, skin texture, hair) without creating artificial features.
Restore clothing, background, and small objects while maintaining their original appearance.

Quality guidelines:

Preserve the original identity, facial proportions, expression, and age of all subjects.
Keep the restoration realistic and historically accurate.
Do not alter clothing, hairstyles, accessories, or the scene unless reconstructing damaged portions.
Avoid over-sharpening, excessive smoothing, HDR effects, or an AI-generated look.
Maintain the original framing and perspective.

Output:
Produce a clean, high-resolution restoration that looks like a well-preserved original photograph rather than a modern recreation.`,
    exampleTag: "vintage",
    benefits: [
      {
        icon: "sparkles",
        title: "Repair damage",
        description:
          "Erase scratches, creases, dust and torn areas while preserving the character of the original photo.",
      },
      {
        icon: "scan-face",
        title: "Sharpen faces",
        description:
          "Recover soft or blurry facial detail so the people you love look clear again.",
      },
      {
        icon: "palette",
        title: "Fix fading",
        description:
          "Correct washed-out tones and bring back natural, balanced color and contrast.",
      },
    ],
    faqs: [
      {
        question: "Can AI really restore a damaged or faded photo?",
        answer:
          "Yes. Upload a scan or clear photo of the print and the AI reconstructs missing areas, removes scratches, dust, creases and stains, corrects fading, and recovers detail in faces and clothing — often making the image look better than the surviving original while staying true to it.",
      },
      {
        question: "Will the restored photo still look natural and authentic?",
        answer:
          "That's the priority. The restoration is tuned to preserve the original identity, facial proportions, expressions and era of the photo, avoiding an over-smoothed or obviously \"AI\" look. If you'd like it adjusted, run a follow-up edit to fine-tune the contrast, sharpness or color to taste.",
      },
      {
        question: "Can it colorize a black-and-white photo?",
        answer:
          "Yes — just ask for it in your prompt (e.g. \"colorize naturally with realistic skin tones\"). You can also keep it monochrome and simply repair and sharpen it. Either way the original composition and framing are preserved.",
      },
      {
        question: "What kind of scan or photo works best?",
        answer:
          "A sharp, evenly-lit, high-resolution scan or photo of the print gives the best results — the more detail in the input, the more the AI can accurately recover. Try to avoid blurry snaps taken at an angle or in low light.",
      },
    ],
  },
  {
    slug: "anime-ai-art-generator",
    icon: "wand-sparkles",
    label: "Anime Art",
    badge: "Anime AI Generator",
    heading: "Anime AI Art Generator",
    tagline:
      "Create stunning anime characters, scenes and portraits from a simple text prompt.",
    metaTitle: "Anime AI Art Generator — Create Anime Characters Free | Lumiar",
    metaDescription:
      "Generate anime art, characters and scenes with AI. Turn text prompts or your photos into anime style in seconds with Lumiar.",
    intro:
      "Whether you want an original character, a manga-style scene or an anime version of your own photo, Lumiar makes it effortless. Describe the character, outfit and setting — or upload a photo to convert — and generate vibrant anime art in seconds. Perfect for avatars, fan art, comics and profile pictures.",
    heroPrompt:
      "Create an anime-style illustration of a determined young hero with windswept silver hair and expressive, glowing blue eyes. Render it in a modern cel-shaded style with clean line art, vibrant saturated colors and soft gradient shading. Frame a dynamic three-quarter portrait from a slightly low, cinematic camera angle. Light the scene with dramatic rim lighting and a warm key light that catches the hair and face, adding subtle bloom and a gentle lens flare. Place the character against a detailed neon-lit city at dusk with a soft bokeh glow. Include fine details—flowing fabric folds, wind-blown motion, and bright catchlights in the eyes—for a polished, high-quality anime key-visual look.",
    exampleTag: "anime",
    benefits: [
      {
        icon: "user-round",
        title: "Original characters",
        description:
          "Design unique anime characters with the exact hair, outfit, expression and mood you imagine.",
      },
      {
        icon: "image",
        title: "Photo to anime",
        description:
          "Upload a selfie and turn yourself into an anime character for avatars and profile pictures.",
      },
      {
        icon: "layers",
        title: "Any anime style",
        description:
          "From classic cel-shaded to modern, painterly or chibi — just describe the look you're after.",
      },
    ],
    faqs: [
      {
        question: "How do I turn my photo into anime?",
        answer:
          "Upload a clear photo and add a prompt describing the style, for example \"anime style portrait, clean cel shading, vibrant colors\". Generate, then refine with follow-up edits like \"bigger eyes\" or \"add a sunset background\" until it matches the look you want.",
      },
      {
        question: "Can I create original anime characters from scratch?",
        answer:
          "Absolutely — no reference photo needed. Describe the character's hair, eyes, outfit, pose, expression and setting, and the AI designs them for you. The more specific you are about style and mood, the more distinctive the character.",
      },
      {
        question: "What anime styles can it produce?",
        answer:
          "A wide range — classic cel-shaded, modern key-visual, soft painterly, retro 90s and chibi. Just name the style in your prompt, and add references to lighting and composition (e.g. \"dramatic rim lighting, three-quarter view\") for a more cinematic result.",
      },
      {
        question: "Is it good for profile pictures, avatars and fan art?",
        answer:
          "Yes. Anime portraits are popular for social media, Discord, gaming and streaming avatars, as well as personal fan art. Choose a square (1:1) ratio for avatars, or portrait (2:3) for full-character illustrations.",
      },
    ],
  },
  {
    slug: "ai-logo-generator",
    icon: "pen-tool",
    label: "Logo Ideas",
    badge: "AI Logo Generator",
    heading: "AI Logo Generator",
    tagline:
      "Generate fresh logo concepts and brand marks for your business in seconds.",
    metaTitle: "AI Logo Generator — Create Logo Concepts Free | Lumiar",
    metaDescription:
      "Generate unique logo ideas and brand marks with AI. Describe your business and get concepts in seconds with Lumiar.",
    intro:
      "Kick-start your branding with AI-generated logo concepts. Describe your company, industry and style — minimalist, playful, luxurious, tech — and Lumiar produces distinctive marks and icons you can iterate on. A fast way to explore directions before committing to a final design.",
    heroPrompt:
      "Design a clean, modern logo for a specialty coffee brand called 'Aroma'. Center a simple, memorable geometric coffee-bean icon paired with a confident lowercase sans-serif wordmark. Use a warm, minimal palette of espresso brown and soft cream with a single subtle accent tone. Keep the mark flat and vector-style with balanced negative space, crisp edges and even stroke weights so it stays legible even at very small sizes. Present it centered on a clean, solid background, well suited for an app icon, packaging and signage. Prioritize simplicity, memorability and timeless brand appeal over decorative detail.",
    exampleTag: "logo",
    benefits: [
      {
        icon: "shapes",
        title: "Endless concepts",
        description:
          "Explore dozens of directions quickly instead of paying for a single first draft.",
      },
      {
        icon: "sliders-horizontal",
        title: "On-brand styles",
        description:
          "Specify colors, mood and typography feel to match your brand identity.",
      },
      {
        icon: "refresh-cw",
        title: "Iterate instantly",
        description:
          "Like a direction? Refine it with follow-up prompts until it clicks.",
      },
    ],
    faqs: [
      {
        question: "How do I generate a logo with AI?",
        answer:
          "Describe your business name, industry, the style you're after (minimalist, playful, luxury, tech) and any preferred colors, then generate. Create several variations, compare directions, and refine your favorite with follow-up prompts until it feels right.",
      },
      {
        question: "Can I use an AI-generated logo commercially?",
        answer:
          "AI concepts are an excellent, affordable way to explore your brand quickly. For a final production logo, we recommend refining your favorite concept and having it redrawn as a clean, scalable vector so it stays crisp at every size and is print-ready.",
      },
      {
        question: "What makes a good logo prompt?",
        answer:
          "Be specific: mention your industry, the personality you want to convey (modern, friendly, premium), a color palette, and whether you want an icon, a wordmark or both. Asking for a \"flat, minimal, vector style on a plain background\" tends to produce the cleanest, most usable marks.",
      },
      {
        question: "Can I match my existing brand colors and style?",
        answer:
          "Yes. Include your exact colors (or describe them) and the overall feel you want, and the AI generates concepts around them. Iterate a few times to align the results more closely with your existing brand identity.",
      },
    ],
  },
  {
    slug: "ai-product-photography",
    icon: "package",
    label: "Product Shots",
    badge: "AI Product Photography",
    heading: "AI Product Photography Generator",
    tagline:
      "Create scroll-stopping product shots and lifestyle scenes without a studio.",
    metaTitle: "AI Product Photography Generator — Studio Shots | Lumiar",
    metaDescription:
      "Generate professional product photos and lifestyle scenes with AI. Perfect for e-commerce, ads and social. Try Lumiar free.",
    intro:
      "Selling online means great product imagery — but studio shoots are slow and expensive. With Lumiar you can generate clean studio shots, lifestyle scenes and seasonal backdrops for your products in seconds. Describe the product and setting, or upload your product photo to place it in a new scene.",
    heroPrompt:
      "Create a premium studio product photograph of a frosted-glass skincare bottle. Place the product on a polished marble surface with a soft, minimal, complementary background that makes it stand out. Use clean, directional softbox lighting with a gentle reflection beneath the bottle and delicate water droplets on the glass for a fresh, luxurious feel. Compose a tight, centered hero shot at a slight three-quarter angle with a shallow depth of field so the label stays crisp and in focus. Keep colors accurate and true-to-life, with subtle shadows, fine detail and a bright, high-end commercial finish ready for an e-commerce listing or advertisement.",
    exampleTag: "product",
    benefits: [
      {
        icon: "store",
        title: "E-commerce ready",
        description:
          "Clean, consistent shots that look right at home on your store, marketplace or ad.",
      },
      {
        icon: "sun",
        title: "Any setting",
        description:
          "Studio white, marble, outdoor, seasonal — place your product in any scene you can describe.",
      },
      {
        icon: "wallet",
        title: "Skip the studio",
        description:
          "No photographer, set or equipment. Generate a whole catalog of looks for a fraction of the cost.",
      },
    ],
    faqs: [
      {
        question: "Can I use my own product photo?",
        answer:
          "Yes. Upload a photo of your product and describe the new scene, surface or background you want — the AI restyles the shot while keeping your product recognizable. It's ideal for placing the same item in multiple settings without a reshoot.",
      },
      {
        question: "Are the results good enough for my online store?",
        answer:
          "Lumiar produces high-resolution, professional-looking product imagery with clean lighting and realistic detail — suitable for e-commerce listings, marketplaces, ads and social media. Generate a consistent set of shots to give your storefront a cohesive, premium look.",
      },
      {
        question: "What kinds of scenes can I create?",
        answer:
          "Almost anything you can describe: clean studio white, marble or wood surfaces, lifestyle settings, outdoor scenes, and seasonal or holiday backdrops. Mention the lighting (soft or dramatic), angle and mood for a finished, on-brand result.",
      },
      {
        question: "Which aspect ratio should I use?",
        answer:
          "Square (1:1) works well for most marketplaces and product grids, portrait (2:3 or 4:5) suits social feeds like Instagram, and wide (16:9) is great for banners, ads and hero images. You can generate the same product in several ratios.",
      },
    ],
  },
  {
    slug: "photorealistic-ai-images",
    icon: "camera",
    label: "Photorealistic",
    badge: "Photorealistic AI",
    heading: "Photorealistic AI Image Generator",
    tagline:
      "Generate lifelike, camera-quality images that are hard to tell from real photos.",
    metaTitle: "Photorealistic AI Image Generator — Lifelike Photos | Lumiar",
    metaDescription:
      "Create photorealistic AI images with lifelike detail and lighting. Perfect for concepts, mockups and content. Try Lumiar free.",
    intro:
      "Need images that look genuinely photographed? Lumiar's photorealistic generation produces lifelike detail, natural lighting and true-to-life textures. Great for content, mockups, moodboards and concepts when a real photo isn't available. Describe the scene like a photographer — lens, lighting, time of day — for the most convincing results.",
    heroPrompt:
      "Create a photorealistic portrait of a woman standing beside a large window, bathed in soft, natural morning light. Shoot as if captured on a full-frame camera with an 85mm f/1.8 lens, giving a shallow depth of field and a gently blurred background. Compose a natural head-and-shoulders frame with the subject looking slightly off-camera in a relaxed, candid moment. Render lifelike skin with realistic texture and subtle imperfections, bright catchlights in the eyes, and true-to-life color and contrast. Include fine details—individual strands of hair, fabric weave and a touch of natural film grain—for a convincing, editorial-quality photograph that is hard to distinguish from a real photo.",
    exampleTag: "photorealistic",
    benefits: [
      {
        icon: "aperture",
        title: "True-to-life detail",
        description:
          "Realistic textures, lighting and depth of field that read as genuine photography.",
      },
      {
        icon: "image",
        title: "Any subject",
        description:
          "People, places, food, products — generate believable photos of almost anything.",
      },
      {
        icon: "settings-2",
        title: "Photographer controls",
        description:
          "Specify the lens, lighting and mood in your prompt for precise, convincing results.",
      },
    ],
    faqs: [
      {
        question: "How do I get the most realistic results?",
        answer:
          "Write your prompt like a photographer. Specify the lens (e.g. 85mm f/1.8), the lighting (soft natural window light, golden hour), the time of day, camera angle and depth of field. Concrete photographic detail — plus asking for realistic skin texture and catchlights — is what pushes results from \"AI-looking\" to convincingly real.",
      },
      {
        question: "Which model should I use for photorealism?",
        answer:
          "Lumiar offers several leading image models, each with different strengths. Try a few from the model selector — some are exceptional at realistic people and portraits, while others shine with scenes, food or products. Compare and pick the one that best fits your subject.",
      },
      {
        question: "Can I make a real photo look more polished?",
        answer:
          "Yes. Upload a photo and describe the improvements you want — better lighting, a cleaner background, sharper detail or color correction — and the AI enhances it while keeping it looking authentic and natural.",
      },
      {
        question: "Can I generate realistic people, places and products?",
        answer:
          "You can generate believable images of almost any subject: portraits, interiors, landscapes, food and product shots. For people, use a clear reference and a detailed lighting description; for scenes, describe the environment, atmosphere and camera setup for the most convincing result.",
      },
    ],
  },
];

export function getUseCase(slug: string): UseCase | undefined {
  return USE_CASES.find((u) => u.slug === slug);
}
