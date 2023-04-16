import Joi from "joi";
import { stripHtml } from "string-strip-html";

// console.log(stripHtml('<div>Isso é uma div</div>'));

function useStripHtml(test){
    return stripHtml(test).result;
}

const scheme=Joi.object({
    test: Joi.string().custom(useStripHtml)
})

const validation=scheme.validate({test: '<div>Isso é uma div</div>'});
console.log(validation.value.test);