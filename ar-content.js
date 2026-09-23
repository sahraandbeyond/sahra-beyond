/* Arabic copy for the commercial core.
   Written 21 Sep 2026, revised the same day after five independent expert reviews.
   ------------------------------------------------------------------------------
   TRANSCREATED, not translated. The English voice is plain, concrete and
   understated. A literal rendering of it reads flat in Arabic, so each string is
   written as Arabic brand copy carrying the same claim and no more.

   Changes made from review, with the reason, so none of these get "corrected"
   back by someone reading only the English:

   1. القطارة -> القوع.  THE IMPORTANT ONE. القطارة is Al Qattara, the oasis and
      arts centre inside Al Ain city - a different place entirely. Al Quaa, the
      dark-sky site, is القوع: confirmed against Arabic UAE coverage of this exact
      location ("موقع مجرة درب التبانة في القوع", "سماء صحراء القوع في أبوظبي").
      Naming the wrong place would have broken the one thing the brand claims -
      that these are real places you can go to.
   2. مطرّز removed from the hero. It said every tee is embroidered. Per the brief
      only the Empty Quarter tee and the polo are embroidered; Al Quaa and Wadi
      Naqab are DTG printed. That was a production claim the range does not back.
      NOTE: the ENGLISH homepage still carries the same overclaim - flagged.
   3. أصفى -> أظلم, accessibility hedge KEPT. The brief's rule is "one of the
      darkest ACCESSIBLE skies", and Arabic UAE media uses أظلم for dark-sky sites
      (Abu Dhabi Culture: "أظلم بقعة في الإمارات"). Two reviewers wanted the hedge
      dropped for readability - refused, it is what keeps the claim substantiated.
      Reworded instead so it stops reading like a permit application.
   4. ارتدِ -> البس. ارتدِ is the register of public-health signage ("ارتدِ
      الكمامة"). البس is what people actually say and write in Gulf retail.
   5. ملصق -> بطاقة for the collar label. ملصق is a sticker or a poster; a shopper
      pictures something glued to their neck. بطاقة is the garment-tag word - and
      this line exists to protect the printed-not-woven rule, so it has to land.
   6. تي شيرت -> تيشيرت. One word is the spelling Gulf retailers index under.
   7. "ليوا · الربع الخالي" -> "ليوا والربع الخالي". The interpunct is a Latin
      typographic import; Arabic does not join place names with a middle dot.
   8. تصفّح -> تسوّق on the CTA: a buying verb, not a looking one.
   9. Diacritics made consistent (مُمشّط، غرامًا) - the proofreader caught home.desc
      carrying an under-vocalised copy of a phrase vocalised everywhere else.
   10. تلهب and the second "يمكن الوصول إليها" removed - literary/bureaucratic
      register in the two most important paragraphs.

   NOT changed, deliberately: no cash-on-delivery, BNPL or refund copy was added.
   Reviewers asked for all three. None is a confirmed fact in the brief, and the
   substantiation rule says the default while a fact is open is silence.

   Hard rules held: 230 GSM tees / 240 GSM polo; combed ring-spun, never organic;
   no numbering; الإصدار التأسيسي, never "founding pricing". Western digits. */

module.exports = {
  brand: 'صحراء',
  brandFull: 'صحراء وما بعدها',
  tagline: 'البس وجه الإمارات البرّي',

  home: {
    title: 'تيشيرت إماراتي من أماكن حقيقية | صحراء وما بعدها',
    desc: 'تيشيرت إماراتي 230 غرامًا من قطن مُمشّط، مستوحى من أماكن حقيقية: سماء القوع، كثبان ليوا، وجبال الحجر. إصدار محدود وتوصيل مجاني في الإمارات.',
    h1: 'البس وجه الإمارات البرّي.',
    lede: 'تيشيرت ثقيل من قطن مُمشّط، 230 غرامًا. ثلاثة تصاميم من صحارى الإمارات وأوديتها وسماء لياليها. 199 درهمًا.',
    ctaShop: 'تسوّق المجموعة',
    ctaPlaces: 'قصة الأماكن',
    editionEyebrow: 'الإصدار التأسيسي',
    editionTitle: 'الدفعة الأولى',
    editionText: 'ثلاثة أماكن، ثلاثة تصاميم، وبولو واحد. دفعة أولى محدودة — حين ينفد مقاس، ينفد.',
    placesTitle: 'ثلاثة أماكن حقيقية',
    placesText: 'كل تصميم يبدأ من مكان يمكنك الذهاب إليه فعلًا، لا من رسم عام عن الصحراء.'
  },

  places: [
    { name: 'القوع', emirate: 'أبوظبي',
      text: 'سماؤها من أظلم ما يمكنك بلوغه في الإمارات. مجرّة درب التبانة تُرى بالعين المجردة في الليالي الصافية.' },
    { name: 'ليوا والربع الخالي', emirate: 'أبوظبي',
      text: 'حافة الربع الخالي، حيث ترتفع الكثبان إلى مئات الأمتار وتغيب الشمس خلف خطوطها.' },
    { name: 'وادي نقب', emirate: 'رأس الخيمة',
      text: 'وادٍ يشقّ جبال الحجر، وبرك ماء صافية بعد المطر.' }
  ],

  about: {
    title: 'من نحن — قصة صحراء وما بعدها',
    desc: 'صحراء وما بعدها: علامة إماراتية مستوحاة من صحارى البلاد وجبالها وأوديتها، صُنعت لتدلّك على الجانب البرّي من الإمارات.',
    h1: 'من نحن',
    body: [
      'بدأت صحراء من عادة بسيطة: الخروج من المدينة في نهاية الأسبوع، والعودة بصور لأماكن لا يعرفها كثيرون رغم قربها.',
      'الإمارات التي نعرفها ليست ناطحات سحاب فقط. فيها سماء ليلية من أظلم ما يمكنك بلوغه، وكثبان بارتفاع مئات الأمتار. وفيها أودية تمتلئ ببرك صافية بعد المطر، وجبال هواؤها بارد رغم حرّ الساحل.',
      'كل تصميم هنا يبدأ من مكان حقيقي زرناه، لا من فكرة عامة عن الصحراء. ولذلك نضع اسم المكان على القطعة، ونكتب عنه صفحة كاملة تخبرك كيف تصل إليه ومتى تذهب.',
      'نصنع دفعات صغيرة. حين ينفد مقاس، ينفد — لا لأننا نفتعل الندرة، بل لأن الدفعة الأولى صغيرة بطبيعتها.'
    ]
  },

  contact: {
    title: 'تواصل معنا | صحراء وما بعدها',
    desc: 'تواصل مع صحراء وما بعدها — أسئلة عن المقاسات أو طلبك أو الاستبدال. نرد خلال يوم عمل واحد.',
    h1: 'تواصل معنا',
    lede: 'سؤال عن المقاس، أو عن طلبك، أو عن الاستبدال؟ اكتب لنا وسنرد خلال يوم عمل واحد.',
    emailLabel: 'البريد الإلكتروني',
    waLabel: 'واتساب'
  },

  ui: {
    shopCta: 'أضف إلى السلة',
    sizeGuide: 'دليل المقاسات',
    price: (n) => `${n} درهمًا`,
    deliveryLine: 'توصيل مجاني في الإمارات خلال يوم العمل التالي — اطلب قبل الساعة 2 ظهرًا.',
    exchangeLine: 'استبدال مجاني خلال 14 يومًا.',
    gsmTee: 'قطن مُمشّط مغزول حلقيًا، 230 غرامًا',
    gsmPolo: 'قطن بيكيه 240 غرامًا',
    labelPrinted: 'بطاقة رقبة مطبوعة',
    switchToEn: 'English',
    switchToAr: 'العربية',
    footerRights: 'جميع الحقوق محفوظة'
  }
};
