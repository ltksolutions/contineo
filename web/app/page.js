/**
 * Koreň `/`.
 *
 * **Za bežnej prevádzky sem nikto nepríde** — `middleware.js` prepisuje `/`
 * na `/sk` skôr, než sa smerovanie dostane sem. Súbor zostáva ako záchrana
 * pre prípad, že by middleware prestal bežať; vtedy je presmerovanie
 * lepšie než 404.
 *
 * Pozor pri úpravách: presmerovanie odtiaľto **nestačí**. Je to odpoveď 307
 * a scraper, ktorý ju dostane, náhľad odkazu nevyrobí — presne kvôli tomu
 * middleware vznikol. Dôvody sú zapísané tam.
 */
import { redirect } from "next/navigation";

export default function Index() {
  redirect("/sk");
}
