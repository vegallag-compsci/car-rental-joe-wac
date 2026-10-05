// ---------------------------------------------------------------------------
// CUSTOMER REVIEWS: edit this file to change what /reviews shows.
//
// Each review is one { ... } block. To add a review, copy a block and change
// the values; to remove one, delete its block. The page sorts by date
// itself, so order here doesn't matter.
//
//   id          any unique number (just don't repeat one)
//   name        shown as the reviewer's name
//   avatar_url  link to a profile picture. Leave as '' to show their initial
//               instead. A broken link also falls back to the initial.
//   rating      whole stars, 1 to 5
//   date        'YYYY-MM-DD', e.g. '2026-09-14'
//   car         optional: the car they rented ('' to hide)
//   title       short headline
//   body        the review text
//
// These are sample reviews for the class project. If this site is ever used
// for a real business, replace them with real ones: invented reviews
// presented as genuine are illegal for real businesses (in the US, the FTC's
// 2024 rule on fake reviews).
// ---------------------------------------------------------------------------

// Shown under the page title. Set to '' to hide it.
export const REVIEWS_NOTE = 'Hear from real people who have used our services!'

export const reviews = [
  {
    id: 1,
    name: 'Professor Dinkleferd',
    avatar_url: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSohJCR1HA0_1hh0J7TSOYHGHYAoPrOF5UPcVPX5Yp2Wg&s=10',
    rating: 5,
    date: '2026-09-28',
    car: 'Toyota Camry',
    title: 'Great for Ferding',
    body: 'My car was great i got sendy all over it.',
  },
  {
    id: 2,
    name: 'Daniel Okafor',
    avatar_url: 'https://i.pravatar.cc/150?img=12',
    rating: 4,
    date: '2026-09-15',
    car: 'Jeep Grand Cherokee',
    title: 'Great SUV for a weekend trip',
    body: 'Plenty of room for four of us and our bags. Pickup took a few minutes longer than expected, but the staff were friendly and the Jeep drove great.',
  },
  {
    id: 3,
    name: 'Priya Raman',
    avatar_url: 'https://i.pravatar.cc/150?img=32',
    rating: 5,
    date: '2026-08-30',
    car: 'BMW 5 Series',
    title: 'Worth the splurge',
    body: 'Rented the BMW for a wedding. It was immaculate and felt brand new. Cancelling one of my other bookings was also painless.',
  },
  {
    id: 4,
    name: 'Marcus Lee',
    avatar_url: 'https://images.ctfassets.net/l7h59hfnlxjx/6CHW66qpj6xhCpywkIqKGg/974baaec51a038bdd11d704045e07a2c/P44_headshot.png?q=75&w=1014&fm=',
    rating: 3,
    date: '2026-08-11',
    car: 'Kia Rio',
    title: 'Fine for getting around town',
    body: 'Cheap and reliable, which is what I needed. A little small for road trips, and I wish there were more automatic options in Economy.',
  },
  {
    id: 5,
    name: 'Sofia Martinez',
    avatar_url: 'https://i.pravatar.cc/150?img=45',
    rating: 5,
    date: '2026-07-22',
    car: 'Chrysler Pacifica',
    title: 'Perfect family van',
    body: 'Seven seats, tons of storage, and the kids loved it. The booking page made it obvious what we would pay before we committed.',
  },
  {
    id: 6,
    name: 'Nora Levy',
    avatar_url: 'https://media.licdn.com/dms/image/v2/D5603AQGND89drYYXVQ/profile-displayphoto-crop_800_800/B56Zrn_vi2HQAI-/0/1764828840158?e=1792627200&v=beta&t=aby25XYq___lgk2ciQIMk-w5mSHZFLphskoRX2-uJ7o',
    rating: 4,
    date: '2026-07-03',
    car: 'DaBaby Mobile',
    title: 'Smooth and simple',
    body: 'Comfortable car with good mileage. Only knock is that I would like to be able to change my dates online instead of cancelling and rebooking.',
  },
]
