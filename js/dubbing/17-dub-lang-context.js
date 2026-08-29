// # FILE frontend/sl-dubbing-frontend-main/js/dubbing/17-dub-lang-context.js
// # AR واجهة الدبلجة — رفع، Start، polling، أصوات
// # KW لغة,language
// # CONVENTION — FN/AR/KW + # block كل ~6 أسطر — FUNCTION_INDEX.md DOMAIN_INDEX.md
// js/dubbing/17-dub-lang-context.js — Resolve dub API language fields (source/target/translate)
(function (global) {
  'use strict';

  // # FN lookupLang
  // # AR اللغات واللهجات (lookupLang)
  // # KW لغة,language,dialect
  function lookupLang(code) {
    return global.LANGUAGES?.find((l) => l.code === code) || null;
  }

  // # FN baseOf
  // # AR اللغات واللهجات (baseOf)
  // # KW لغة,language,dialect
  function baseOf(code, info) {
    // # return — إرجاع النتيجة
    return info?.base_lang || (code || '').split('-')[0] || '';
  }

  /** resolveDubbingRequestLangFields — يمنع إعادة ترجمة LLM عندما المصدر = الهدف */
  // # FN resolveDubbingRequestLangFields
  // # AR حل/استنتاج dubbing request lang fields (resolveDubbingRequestLangFields)
  // # KW لغة,language,dialect
  function resolveDubbingRequestLangFields(sourceCode, targetCode) {
    const srcInfo = lookupLang(sourceCode);
    const tgtInfo = lookupLang(targetCode);
    const srcBase = baseOf(sourceCode, srcInfo);
    const tgtBase = baseOf(targetCode, tgtInfo);
    const sourceDialect = srcInfo?.dialect || '';
    // # block — تنفيذ منطق — راجع الأسطر التالية
    const targetDialect =
      tgtInfo?.dialect || (tgtInfo?.base_lang === 'ar' ? 'الفصحى' : '');

    let translate = true;
    // # شرط — فرع منطقي
    if (sourceCode && targetCode) {
      // # شرط — فرع منطقي
      if (sourceCode === targetCode) {
        translate = false;
      // # block — خطوة ترجمة (مترجم)
      } else if (
        srcBase === tgtBase &&
        sourceDialect &&
        targetDialect &&
        sourceDialect === targetDialect
      ) {
        // # block — خطوة ترجمة (مترجم)
        translate = false;
      } else if (srcBase === tgtBase && sourceCode === srcBase && targetCode === tgtBase) {
        translate = false;
      }
    }

    // # return — إرجاع النتيجة
    return {
      // # block — خطوة ترجمة (مترجم)
      source_language: sourceCode,
      source_dialect: sourceDialect,
      dialect: targetDialect,
      target_language: tgtBase,
      translate,
    };
  }

  const DubbingApp = (global.DubbingApp = global.DubbingApp || {});
  DubbingApp.langContext = { resolveDubbingRequestLangFields };
  global.resolveDubbingRequestLangFields = resolveDubbingRequestLangFields;
})(window);
