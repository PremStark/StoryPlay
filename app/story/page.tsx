import Link from 'next/link'

const books = [
  { slug: 'harry-potter', title: 'Harry Potter', subtitle: 'The Wizarding World', author: 'A magical mystery', theme: 'magic', mark: 'HP', description: 'Take a turn at the edge of a world where every choice carries a little magic.' },
  { slug: 'game-of-thrones', title: 'Game of Thrones', subtitle: 'A Song of Ice & Fire', author: 'A tale of crowns', theme: 'thrones', mark: 'GT', description: 'Step into a kingdom of alliances, ambition, and impossible decisions.' },
  { slug: 'fight-club', title: 'Fight Club', subtitle: 'Rules are made to break', author: 'An untold perspective', theme: 'fight', mark: 'FC', description: 'Follow a path through identity, rebellion, and a very different kind of freedom.' },
  { slug: 'shawshank-redemption', title: 'The Shawshank Redemption', subtitle: 'Hope is a good thing', author: 'A story of resilience', theme: 'shawshank', mark: 'SR', description: 'Find the moments where patience, courage, and hope change the ending.' },
]

export default function StoryLibrary() {
  return (
    <main className="library-shell">
      <nav className="library-nav">
        <Link className="brand" href="/"><span className="brand-mark">*</span> Persona</Link>
        <Link className="back-home" href="/"><span>&larr;</span> Back to home</Link>
      </nav>
      <section className="library-hero">
        <p className="eyebrow"><span /> CHOOSE YOUR STORY</p>
        <h1>Every book holds<br />a different <em>door.</em></h1>
        <p>Choose the world you want to enter. Soon, you&apos;ll be able to bend its story in your own direction.</p>
      </section>
      <section className="bookcase" aria-label="Story collection">
        {books.map((book, index) => (
          <Link href={`/story/${book.slug}`} className={`library-book ${book.theme}`} key={book.slug}>
            <div className="library-pages" />
            <article className="library-cover">
              <p className="library-number">0{index + 1} / 04</p>
              <span className="book-mark">{book.mark}</span>
              <div className="library-title"><h2>{book.title}</h2><i>{book.subtitle}</i></div>
              <div className="cover-line" />
              <p className="book-author">{book.author}</p>
              <span className="open-book">Open story <b>&rarr;</b></span>
            </article>
            <span className="book-description">{book.description}</span>
          </Link>
        ))}
      </section>
      <p className="library-footnote">More worlds are finding their way to the shelf.</p>
    </main>
  )
}
