# Photo NationX

Static photography portfolio for Photo NationX. It is meant to be published free on GitHub Pages at [https://photonationx.github.io](https://photonationx.github.io), with no custom domain.

The home page opens with a grid of photographs and the logo in the center. Photos are a thumbnail grid that opens a larger view. Videos are posters that play when selected. About and contact are separate pages. The contact form sends mail through Web3Forms and needs no server of its own.

The galleries are the imported photographs and videos. Importing again replaces them.

## Run locally

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317).

A production build is a folder of static files:

```bash
npm run build
npm run preview
```

`npm run preview` serves `out/` the way GitHub Pages does. Pass `--base /repository-name` to check a project-site address.

## Import an Instagram export

Use Instagram's "Download your information" export in JSON format. Do not commit the export.

```bash
npm run import:instagram -- ~/Downloads/instagram-export
npm run import:instagram -- export-part1.zip export-part2.zip
```

Useful flags: `--category Portraits`, `--dry-run`, `--limit 20`, `--no-videos`, `--stories`, `--keep-samples`.

The script writes responsive WebP images, about-720p MP4 videos with poster frames, and `content/media.json`. It strips EXIF, GPS, and other metadata. Every file stays under 100 MB, and the build fails if the site would pass 900 MB.

## Add photos or videos later

Nothing has to be installed for later additions.

1. On GitHub, open Releases and draft a new release. Do not publish it.
2. Attach photos, videos, or the Instagram `.zip` files. Draft release files stay private and are not part of the git history.
3. Run Actions → **Add photos and videos**. Optional inputs: a category name, and YouTube or Vimeo links separated by spaces.
4. The workflow optimizes the files, commits them as Photo NationX, deletes the draft, and deploys.

The same thing works on a machine that already has this repo:

```bash
npm run media:add -- ./new-photos --category Portraits
npm run media:add -- --link "https://vimeo.com/123456789 https://youtu.be/abcdefghijk"
```

Long or numerous videos should live on YouTube or Vimeo (unlisted is fine) and be added as links, so the repository stays small.

## Settings

`content/site.json` is the copy and the layout.

| Setting | What it does |
| --- | --- |
| `header.logo` | `clean` hides the ring text on the lens. `original` keeps it. |
| `header.nav` | The menu beside the logo. |
| `banner.style` | `collage` uses the supplied collage. `grid` rebuilds the banner from gallery photos with the logo in the center. |
| `banner.gridPhotos` | Photo ids for grid mode, in reading order. Empty uses the newest photos. |
| `photoCategories` | Extra Photos menu items. Created when you import with `--category`. |
| `display.captions` / `display.dates` | Off by default. Captions can name people and places. |
| `display.photoTileAspect` | Thumbnail shape, such as `4/5`. |
| `contact.web3formsAccessKey` | Web3Forms access key. Leave empty until you have one. |

To show captions and dates, set those two flags to `true` and run the import again. The importer keeps a private copy in `private/instagram-text.json`, which git ignores, so the text can be published later without the original export.

## Logo, favicon, and banner

Source artwork lives in `brand/`. `npm run brand` trims the logo, builds the header sizes, makes the favicon from the lens, crops the black bars off the collage, and writes the Open Graph image (`public/brand/og-image.jpg`).

Replace `brand/logo.png` or `brand/collage.webp`, then run `npm run brand` again. If the logo's lens moves, the clean header logo is skipped until `brand/sources.json` is updated, and the favicon falls back to the trimmed logo.

## Contact form

The contact page lists the Photo NationX email. The form also posts to Web3Forms with a honeypot field. Put the access key in `contact.web3formsAccessKey`, or set a repository variable named `WEB3FORMS_ACCESS_KEY`. The deploy workflow passes that variable through, and it overrides the file. The key is safe to ship in the static site; it only lets the form send mail.

Until a key is set, the contact page says the form is not connected yet and points people to the email.

## Deploy on GitHub Pages

1. Create a free GitHub organization named `photonationx`, with membership kept private.
2. Create an empty public repository named `photonationx.github.io`. Do not import this temporary repository. Its first commit was recorded before the Photo NationX git identity existed, so start a new history instead:

   ```bash
   git checkout --orphan publish
   git add -A
   git -c user.name="Photo NationX" -c user.email="photonationx@users.noreply.github.com" commit -m "Publish the Photo NationX site"
   git push -u git@github.com:photonationx/photonationx.github.io.git publish:main
   ```

3. In the repository, set Settings → Pages → Build and deployment → Source to **GitHub Actions**.
4. If you have a Web3Forms access key, add a repository variable named `WEB3FORMS_ACCESS_KEY`.
5. Pushing to `main` runs `.github/workflows/deploy.yml`.

A repository named `<owner>.github.io` is published at the root of the site. Any other repository name is published under `/<repository>`. Set a repository variable `BASE_PATH` only when that automatic path is wrong (use an empty value for the root, or `/name` for a project site).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local site at port 4317 |
| `npm run build` | Static export in `out/` |
| `npm run preview` | Serve `out/` like GitHub Pages |
| `npm run brand` | Rebuild logo, favicon, banner, and social image |
| `npm run import:instagram` | Import an Instagram JSON export |
| `npm run media:add` | Add files, zips, or video links |
| `npm run media:samples` | Rebuild the sample galleries |
| `npm run media:prune` | Delete media files the manifest no longer lists |
| `npm run check:size` | Fail if a file or the site is too large |

## Limits

GitHub warns above 50 MB per file and rejects files over 100 MB. The importer keeps each video under 50 MB when it can, and refuses a file that would still be over 95 MB. The published site is kept under 900 MB so it stays under the 1 GB GitHub Pages limit.
