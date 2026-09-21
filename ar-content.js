/* Arabic copy for the commercial core (21 Sep 2026).
   ------------------------------------------------------------------
   TRANSCREATED, not translated. The English voice is plain, concrete and
   understated - short sentences, real places, no superlatives. A literal
   translation of that reads flat and slightly foreign in Arabic, so each
   string is written as Arabic brand copy carrying the same claim.

   Rules held to throughout, from MASTER_BRIEF:
     - 230 GSM tees, 240 GSM Drop 1 polo. Never 220 for either.
     - "combed ring-spun cotton", NEVER "organic".
     - No numbering, no "1 of N", no "never restocked".
     - "one of the darkest accessible skies", not "the darkest".
     - Founding Edition = الإصدار التأسيسي. Never "founding pricing".
   Every claim here traces to a confirmed fact in the brief. Nothing new is
   asserted in Arabic that is not already true in English.

   Digits: Western numerals are used deliberately. UAE commerce reads prices
   in Western digits; Eastern Arabic numerals would look archaic on a price. */

module.exports = {
  brand: 'صحراء',
  brandFull: 'صحراء وما بعدها',
  tagline: 'ارتدِ الجانب البرّي من الإمارات',

  home: {
    title: 'تي شيرت إماراتي أصلي — من أماكن حقيقية | صحراء',
    desc: 'تي شيرت إماراتي مستوحى من أماكن حقيقية: سماء القطارة المظلمة، كثبان ليوا، وجبال الحجر. قطن ممشّط 230 غرام، إصدار محدود، وتوصيل مجاني في الإمارات.',
    h1: 'ارتدِ الجانب البرّي من الإمارات.',
    lede: 'تي شيرت ثقيل من قطن مُمشّط بوزن 230 غرامًا، مطرّز بصحارى الإمارات وأوديتها وليالي سمائها الصافية. 199 درهمًا.',
    ctaShop: 'تصفّح المجموعة',
    ctaPlaces: 'الأماكن التي خلفها',
    editionEyebrow: 'الإصدار التأسيسي',
    editionTitle: 'الدفعة الأولى',
    editionText: 'ثلاثة أماكن، ثلاثة تصاميم، وقميص بولو واحد. دفعة أولى محدودة — حين ينفد مقاس، ينفد.',
    placesTitle: 'ثلاثة أماكن حقيقية',
    placesText: 'كل تصميم يبدأ من مكان يمكنك الذهاب إليه فعلًا، لا من رسم عام عن الصحراء.'
  },

  places: [
    { name: 'القطارة', emirate: 'أبوظبي',
      text: 'واحدة من أصفى السماوات الليلية التي يمكن الوصول إليها في الإمارات. مجرّة درب التبانة تُرى بالعين المجردة في الليالي الصافية.' },
    { name: 'ليوا · الربع الخالي', emirate: 'أبوظبي',
      text: 'حافة الربع الخالي، حيث ترتفع الكثبان إلى مئات الأمتار وتغيب الشمس خلف خطوطها.' },
    { name: 'وادي نقب', emirate: 'رأس الخيمة',
      text: 'وادٍ يشقّ جبال الحجر، وبرك ماء صافية بعد المطر.' }
  ],

  about: {
    title: 'عن صحراء — اكتشف الجانب البرّي من الإمارات',
    desc: 'قصة صحراء: علامة إماراتية مستوحاة من مناظر الإمارات الطبيعية، صُنعت لتدلّك على الجانب البرّي من البلاد.',
    h1: 'عن صحراء',
    body: [
      'بدأت صحراء من عادة بسيطة: الخروج من المدينة في نهاية الأسبوع، والعودة بصور لأماكن لا يعرفها كثيرون رغم قربها.',
      'الإمارات التي نعرفها ليست ناطحات سحاب فقط. فيها سماء ليلية من أصفى ما يمكن الوصول إليه، وكثبان بارتفاع مئات الأمتار، وأودية تمتلئ ببرك صافية بعد المطر، وجبال يبرد هواؤها بينما تلهب الحرارة الساحل.',
      'كل تصميم هنا يبدأ من مكان حقيقي زرناه، لا من فكرة عامة عن الصحراء. ولذلك نضع اسم المكان على القطعة، ونكتب عنه صفحة كاملة تخبرك كيف تصل إليه ومتى تذهب.',
      'نصنع دفعات صغيرة. حين ينفد مقاس، ينفد — لا لأننا نفتعل الندرة، بل لأن الدفعة الأولى صغيرة بطبيعتها.'
    ]
  },

  contact: {
    title: 'تواصل معنا | صحراء',
    desc: 'تواصل مع صحراء — أسئلة عن المقاسات أو الطلبات أو الاستبدال. نرد خلال يوم عمل واحد.',
    h1: 'تواصل معنا',
    lede: 'أسئلة عن المقاس، أو طلب قائم، أو استبدال؟ اكتب لنا وسنرد خلال يوم عمل واحد.',
    emailLabel: 'البريد الإلكتروني',
    waLabel: 'واتساب'
  },

  /* Shared furniture */
  ui: {
    shopCta: 'أضف إلى السلة',
    sizeGuide: 'دليل المقاسات',
    price: (n) => `${n} درهمًا`,
    deliveryLine: 'توصيل مجاني في الإمارات خلال يوم العمل التالي — اطلب قبل الساعة 2 ظهرًا.',
    exchangeLine: 'استبدال مجاني خلال 14 يومًا.',
    gsmTee: 'قطن مُمشّط 230 غرامًا',
    gsmPolo: 'قطن بيكيه 240 غرامًا',
    labelPrinted: 'ملصق رقبة مطبوع',
    switchToEn: 'English',
    switchToAr: 'العربية',
    footerRights: 'جميع الحقوق محفوظة',
    noticeEn: 'This page is available in English.'
  }
};
