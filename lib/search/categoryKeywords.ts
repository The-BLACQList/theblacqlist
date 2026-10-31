// The words people type that a category name does not say.
//
// lib/search/assist.ts already matches a search against every category's own
// name and slug, so "plumbing" finds Plumbing with no help. This list is for the
// rest: someone who types "plumber", "leak" or "toilet" means Plumbing too, and
// a category chip is a far better answer to that search than a blank page.
//
// Rules for adding words:
//   * Only words a real person would type for this category. No guesses at SEO.
//   * Lowercase. Plurals are optional, the matcher folds "braids" to "braid".
//   * A phrase ("mother's day") matches only when the whole phrase is in the
//     search, so it can be more specific than its single words.
//   * Keep a word on one category unless it truly means both.
//   * Every key must be a real slug. tests/search-assist.test.ts checks each
//     one against seed.sql plus the category migrations, so a renamed category fails loudly
//     instead of quietly dropping out of search help.

export const CATEGORY_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  // Travel & Transportation
  'travel-agencies': [
    'trip', 'vacation', 'flight', 'cruise', 'tour', 'honeymoon', 'getaway', 'passport',
    'abroad', 'international', 'destination', 'resort', 'itinerary', 'travel agent',
    'solo travel', 'group trip',
  ],
  'car-services-black-cars': ['chauffeur', 'limo', 'limousine', 'driver', 'black car', 'sedan'],
  'shuttle-airport-transport': ['airport', 'shuttle', 'ride to the airport'],
  'delivery-services': ['courier', 'deliver', 'errand'],
  'freight-logistics': ['trucking', 'shipping', 'logistic', 'freight'],

  // Food & Dining
  restaurants: [
    'food', 'eat', 'dinner', 'lunch', 'brunch', 'breakfast', 'soul food', 'bbq', 'barbecue',
    'wings', 'seafood', 'vegan', 'caribbean', 'jamaican', 'african', 'ethiopian', 'nigerian',
    'haitian', 'cajun', 'creole', 'pizza', 'burger', 'tacos', 'chicken', 'fish fry', 'jerk',
  ],
  'bakeries-pastry-shops': ['cake', 'cupcake', 'pie', 'cookie', 'bread', 'dessert', 'pastry', 'sweets'],
  'cafes-coffee': ['coffee', 'latte', 'espresso', 'tea', 'cafe'],
  'bars-lounges': ['drinks', 'cocktail', 'wine', 'beer', 'hookah', 'nightlife', 'lounge'],
  'food-trucks': ['truck'],
  'grocery-markets': ['grocery', 'groceries', 'produce', 'market', 'supermarket'],
  'juice-bars-smoothies': ['juice', 'smoothie', 'acai'],
  'meal-prep-delivery': ['meal prep', 'meals', 'personal chef', 'chef'],
  'catering-events-food': ['catering', 'caterer'],

  // Beauty & Grooming
  'barber-shops': ['barber', 'haircut', 'fade', 'lineup', 'shape up', 'beard'],
  'braiding-extensions': ['braid', 'knotless', 'box braids', 'weave', 'wig', 'sew in', 'extension', 'cornrow', 'twist'],
  'hair-salons': ['hair', 'hairstylist', 'stylist', 'silk press', 'relaxer', 'blowout', 'color'],
  'locs-natural-hair': ['loc', 'dreads', 'dreadlocks', 'retwist', 'natural hair', 'afro'],
  'estheticians-skincare': ['facial', 'skin', 'skincare', 'acne', 'waxing', 'lash', 'brows'],
  'makeup-artists': ['makeup', 'mua', 'glam'],
  'nail-salons-spas': ['nails', 'manicure', 'pedicure', 'acrylics', 'gel'],
  'mens-grooming': ['grooming', 'shave'],

  // Healthcare and wellness
  dentists: ['dentist', 'teeth', 'tooth', 'dental', 'orthodontist', 'braces', 'cleaning teeth'],
  'primary-care-physicians': ['doctor', 'physician', 'checkup', 'physical exam', 'clinic'],
  'mental-behavioral-health': ['psychiatrist', 'psychologist', 'anxiety', 'depression'],
  'mental-health-therapy': ['therapist', 'therapy', 'counselor', 'counseling'],
  'urgent-care': ['urgent', 'walk in clinic'],
  'vision-optometry': ['eye', 'eyes', 'glasses', 'contacts', 'optometrist', 'eye doctor'],
  'telehealth-services': ['virtual doctor', 'online doctor', 'telemedicine'],
  'specialty-medicine': ['dermatologist', 'obgyn', 'gynecologist', 'cardiologist', 'specialist', 'midwife', 'doula'],
  'pediatric-healthcare': ['pediatrician', 'kids doctor'],
  'fitness-studios': ['gym', 'workout', 'fitness', 'boxing', 'dance class', 'spin'],
  'personal-trainers': ['trainer', 'personal training', 'weight loss'],
  'yoga-pilates': ['yoga', 'pilates', 'meditation'],
  'massage-therapy': ['massage', 'bodywork'],
  'chiropractic-physical-therapy': ['chiropractor', 'back pain', 'physical therapy', 'pt'],
  'nutritionists-dietitians': ['nutrition', 'diet', 'dietitian', 'nutritionist'],
  'holistic-integrative-health': ['holistic', 'herbal', 'acupuncture', 'reiki', 'naturopath'],

  // Home and trades
  plumbing: ['plumber', 'leak', 'pipe', 'toilet', 'drain', 'water heater', 'clog'],
  electricians: ['electrician', 'electrical', 'wiring', 'outlet', 'breaker', 'lighting'],
  hvac: ['ac', 'air conditioning', 'heating', 'furnace', 'heat pump', 'air conditioner'],
  'general-contractors': ['contractor', 'builder', 'construction', 'remodel', 'addition'],
  'carpentry-woodworking': ['carpenter', 'cabinets', 'deck', 'woodwork'],
  'flooring-tile': ['floor', 'tile', 'hardwood', 'carpet'],
  'painting-finishing': ['painter', 'paint'],
  'cleaning-services': ['cleaner', 'maid', 'housekeeping', 'janitorial', 'deep clean', 'house cleaning'],
  'home-repair-renovation': ['handyman', 'repair', 'renovation', 'fix', 'roof', 'roofer', 'windows'],
  'landscaping-outdoor': ['lawn', 'yard', 'landscaper', 'mowing', 'garden', 'tree'],
  'moving-storage': ['mover', 'movers', 'moving', 'storage'],
  'interior-design': ['designer', 'decorating', 'decorator'],
  'furniture-decor': ['furniture', 'decor', 'sofa', 'couch'],

  // Legal, money and business
  'law-legal-services': ['lawyer', 'attorney', 'legal', 'law firm', 'law office', 'legal services', 'divorce', 'immigration', 'injury', 'criminal defense'],
  'estate-planning': ['will', 'trust', 'probate', 'estate'],
  'tax-services': ['taxes', 'tax return', 'irs'],
  'accounting-tax-preparation': ['accountant', 'cpa', 'bookkeeping', 'bookkeeper', 'payroll'],
  'credit-repair-financial-coaching': ['credit', 'credit score', 'budget', 'debt', 'financial literacy'],
  'banks-credit-unions': ['bank', 'banking', 'checking account', 'savings account', 'credit union'],
  'mortgage-lending': ['mortgage', 'loan', 'home loan', 'refinance', 'lender'],
  'financial-planning-wealth': ['financial advisor', 'investing', 'retirement', 'wealth'],
  insurance: ['insurance', 'life insurance', 'car insurance', 'health insurance'],
  'real-estate': ['realtor', 'real estate agent', 'buy a house', 'homes for sale', 'property', 'rent', 'apartment'],
  'notary-document-services': ['notary', 'notarize', 'apostille'],
  'business-consulting': ['consultant', 'startup', 'business plan', 'small business help'],
  'business-formation-incorporation': ['llc', 'incorporate', 'start a business'],

  // Education and family
  'academic-tutoring': ['tutor', 'tutoring', 'homework', 'math', 'reading', 'science', 'english'],
  'test-preparation': ['sat', 'act', 'gre', 'gmat', 'lsat', 'test prep'],
  'college-prep-counseling': ['college', 'admissions', 'scholarship', 'fafsa'],
  'stem-technology-education': ['coding', 'robotics', 'stem', 'code camp'],
  'music-lessons': ['piano', 'guitar', 'drums', 'voice lessons', 'singing'],
  'after-school-programs': ['after school', 'summer camp', 'camp'],
  'childcare-centers': ['daycare', 'day care', 'preschool', 'child care', 'babysitter'],
  'nannies-au-pairs': ['nanny', 'babysitter', 'sitter'],
  'youth-sports-activities': ['kids sports', 'basketball', 'football', 'soccer', 'swim lessons', 'gymnastics', 'dance'],

  // Shopping and gifts
  'gift-shops': ['gift', 'present', 'birthday', "mother's day", "father's day", 'anniversary', 'christmas', 'holiday'],
  'candles-home-fragrance': ['candle', 'incense', 'fragrance'],
  'handmade-artisan-goods': ['handmade', 'crafts', 'artisan'],
  'cultural-heritage-products': ['kente', 'african print', 'ankara', 'heritage', 'juneteenth'],
  'health-wellness-products': ['skincare products', 'body butter', 'soap', 'shea butter', 'sea moss', 'supplements'],
  bookstores: ['books', 'bookstore', 'book shop'],
  'clothing-boutiques': ['clothes', 'clothing', 'boutique', 'outfit', 'dress'],
  'accessories-jewelry': ['jewelry', 'earrings', 'necklace', 'bracelet', 'rings', 'handbag', 'purse', 'bags'],
  'shoe-stores': ['shoes', 'sneakers', 'boots', 'heels'],
  'streetwear-urban-fashion': ['streetwear', 'hoodie', 'tees', 't-shirt', 'hat'],
  'tailoring-alterations': ['tailor', 'alterations', 'hem'],
  'formal-occasion-wear': ['suit', 'tux', 'tuxedo', 'gown', 'prom', 'wedding dress'],

  // Events and media
  'event-planning': ['party', 'wedding', 'planner', 'party planner', 'event planner', 'party planning', 'event planning', 'baby shower', 'quinceanera', 'event'],
  'venue-rental': ['venue', 'event space', 'hall', 'banquet'],
  'djs-live-music': ['dj', 'band', 'live music', 'musician', 'singer'],
  'balloon-floral-design': ['balloons', 'flowers', 'florist', 'bouquet'],
  'party-supplies-rentals': ['rentals', 'tables', 'chairs', 'bounce house', 'tent'],
  'photo-video-booths': ['photo booth', '360 booth'],
  'wedding-photography': ['wedding photographer', 'engagement photos'],
  'portrait-photography': ['headshots', 'photographer', 'portraits', 'photoshoot'],
  'event-photography': ['event photographer'],
  photography: ['photographer', 'photos', 'photoshoot'],
  'videography-film': ['videographer', 'video', 'film', 'filmmaker'],
  'music-recording': ['studio', 'recording studio', 'producer', 'beats', 'mixing'],
  'graphic-design': ['logo', 'flyer', 'designer', 'branding'],
  'web-app-design': ['website', 'web design', 'web designer'],
  'theater-performing-arts': ['theater', 'theatre', 'play', 'musical', 'show'],
  'museums-galleries': ['museum', 'gallery', 'exhibit', 'art show'],

  // Tech and marketing
  'software-development': ['developer', 'programmer', 'software', 'app'],
  'app-mobile-development': ['app developer', 'mobile app', 'iphone app'],
  'it-support-managed-services': ['computer repair', 'it support', 'tech support', 'laptop', 'network'],
  'social-media-management': ['social media', 'instagram', 'tiktok', 'content manager'],
  'seo-digital-advertising': ['seo', 'google ads', 'ads', 'advertising'],
  'pr-communications': ['publicist', 'pr', 'press'],

  // Pets
  'veterinary-care': ['vet', 'veterinarian', 'animal hospital'],
  'pet-grooming': ['dog grooming', 'groomer'],
  'dog-walking-pet-sitting': ['dog walker', 'pet sitter', 'dog sitter', 'boarding'],
  'pet-training': ['dog trainer', 'obedience'],

  // Automotive
  'auto-repair-mechanics': ['mechanic', 'car repair', 'oil change', 'brakes', 'transmission', 'engine'],
  'car-detailing': ['detail', 'car wash', 'detailer'],
  'towing-roadside': ['tow', 'tow truck', 'roadside'],
  'tire-wheel-services': ['tires', 'rims', 'flat tire'],

  // Community
  'churches-places-of-worship': ['church', 'worship', 'mosque', 'ministry', 'faith'],
  'nonprofits-community-orgs': ['nonprofit', 'non profit', 'charity', 'volunteer', 'community'],
  'mentorship-programs': ['mentor', 'mentorship'],
  'career-coaching': ['career', 'job search', 'career coach'],
  'resume-interview-coaching': ['resume', 'interview', 'cover letter'],
  'temp-contract-staffing': ['temp', 'staffing agency', 'jobs'],

  // Farms
  'farms-farm-stands': ['farm', 'farmer', 'eggs', 'farmers market', 'csa'],
  'plant-shops-nurseries': ['plants', 'nursery', 'houseplants'],
}
