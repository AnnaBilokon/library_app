import { describe, expect, it } from "vitest";
import { cleanTitle, decodeEntities, parseBookPage } from "./parse";

const ld = (obj: unknown) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;

describe("parseBookPage", () => {
  it("reads a schema.org Book (Лабораторія style)", () => {
    const html = `<html><head>
      <meta property="og:image" content="https://laboratory.ua/small.jpg">
      ${ld({ "@type": "Product", name: "Код Троянди", brand: { name: "Лабораторія" } })}
      ${ld({
        "@type": "Book",
        name: "Код Троянди",
        image: "https://laboratory.ua/files/kod_1800x1200.webp",
        datePublished: "2026-08-11",
        isbn: "9786178860028",
        numberOfPages: "624",
        publisher: { "@type": "Organization", name: "Лабораторія" },
        inLanguage: "uk",
        author: [{ "@type": "Person", name: "Кейт Квінн" }],
      })}</head></html>`;
    expect(parseBookPage(html, "https://laboratory.ua/products/kod-troyandy")).toEqual({
      title: "Код Троянди",
      authors: ["Кейт Квінн"],
      publisher: "Лабораторія",
      publishedYear: 2026,
      pages: 624,
      isbn: "9786178860028",
      language: "uk",
      coverUrl: "https://laboratory.ua/files/kod_1800x1200.webp",
    });
  });

  it("reads embedded Next.js data (Старий Лев style)", () => {
    const data = {
      props: {
        pageProps: {
          resource: { name: "Нитка, яка витримала", slug: "knyga-nytka", isbn: "978-966-4487-38-9", year: 2026, qty_pages: 168, edition: { name: "Видавництво Старого Лева" } },
        },
      },
    };
    const html = `<meta property="og:title" content="Нитка, яка витримала  купити у ВСЛ"/>
      <meta property="og:image" content="https://img.example/978-966-448-738-9_2.png"/>
      <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`;
    expect(parseBookPage(html, "https://starylev.com.ua/knyga-nytka")).toMatchObject({
      title: "Нитка, яка витримала",
      publisher: "Видавництво Старого Лева",
      publishedYear: 2026,
      pages: 168,
      isbn: "9789664487389",
      coverUrl: "https://img.example/978-966-448-738-9_2.png",
    });
  });

  it("combines a Product with the spec table (Віват style)", () => {
    const html = `<meta property="og:title" content="📗 Книга «Як насправді влаштований світ» у Vivat"/>
      <meta property="og:image" content="https://vivat.com.ua/resize/974d3efe_9786178053383.jpg"/>
      ${ld({ "@type": "Product", name: "Як насправді влаштований світ", image: "/storage/974d3efe_9786178053383.jpg", brand: { name: "Лабораторія" } })}
      <nav><a>Автори</a><a>Серії</a><a>Новинки</a></nav>
      ${"<p>filler</p>".repeat(30)}
      <div><span>Автор</span><span>Вацлав Сміл</span><span>Видавництво</span><span>Лабораторія</span>
      <span>Кількість сторінок</span><span>312</span><span>Рік видання</span><span>2022</span></div>`;
    expect(parseBookPage(html, "https://vivat.com.ua/product/yak/")).toEqual({
      title: "Як насправді влаштований світ",
      authors: ["Вацлав Сміл"],
      publisher: "Лабораторія",
      publishedYear: 2022,
      pages: 312,
      isbn: "9786178053383",
      coverUrl: "https://vivat.com.ua/storage/974d3efe_9786178053383.jpg",
    });
  });

  it("falls back to OpenGraph and inline 'Label: value' specs", () => {
    const html = `<title>Тіні забутих предків — Книгарня</title>
      <meta property="og:image" content="/img/cover.jpg">
      <p>ISBN: 978-617-585-123-6 (тверда), 978-617-585-124-3 (pdf)</p><p>Мова: Українська</p><p>Сторінок: 200</p>`;
    expect(parseBookPage(html, "https://shop.example/book/1")).toMatchObject({
      title: "Тіні забутих предків",
      pages: 200,
      language: "uk",
      coverUrl: "https://shop.example/img/cover.jpg",
    });
  });

  it("returns nothing useful for an unrelated page", () => {
    expect(parseBookPage("<html><body>Hello</body></html>", "https://example.com/")).toEqual({});
  });
});

describe("cleanTitle", () => {
  it.each([
    ["📗 Книга «Емма» у Vivat", "Емма"],
    ["Емма купити у ВСЛ", "Емма"],
    ["Емма | Книгарня Є", "Емма"],
    ["Книга Емма - купити онлайн", "Емма"],
    ["Код Троянди", "Код Троянди"],
  ])("%s → %s", (raw, expected) => {
    expect(cleanTitle(raw)).toBe(expected);
  });
});

describe("decodeEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("&laquo;Емма&raquo; &amp; &#1042;&#x456;")).toBe("«Емма» & Ві");
  });
});
