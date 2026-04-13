const form = document.getElementById("plan-form");
const examCheckboxes = document.querySelectorAll('input[name="targetExam"]');
const examError = document.getElementById("exam-error");
const countryCodeSelect = document.getElementById("countryCode");
const whatsappInput = document.getElementById("whatsappNumber");
const whatsappError = document.getElementById("whatsapp-error");
const fullWhatsappNumberInput = document.getElementById("fullWhatsappNumber");

function getPhoneMaxLength(countryCode) {
  return countryCode === "+91" ? 10 : 15;
}

function sanitizePhoneNumber(value) {
  return value.replace(/\D/g, "");
}

function syncPhoneInputLimit() {
  const maxLength = getPhoneMaxLength(countryCodeSelect.value);
  whatsappInput.maxLength = maxLength;
  whatsappInput.value = sanitizePhoneNumber(whatsappInput.value).slice(0, maxLength);
}

function validateWhatsappNumber() {
  const countryCode = countryCodeSelect.value;
  const maxLength = getPhoneMaxLength(countryCode);
  const digits = sanitizePhoneNumber(whatsappInput.value).slice(0, maxLength);

  whatsappInput.value = digits;

  if (!digits) {
    whatsappInput.setCustomValidity("Please enter your WhatsApp number.");
    whatsappError.textContent = "Please enter your WhatsApp number.";
    fullWhatsappNumberInput.value = "";
    return false;
  }

  if (countryCode === "+91" && digits.length !== 10) {
    whatsappInput.setCustomValidity("Enter a valid 10-digit number");
    whatsappError.textContent = "Enter a valid 10-digit number";
    fullWhatsappNumberInput.value = "";
    return false;
  }

  if (countryCode !== "+91" && digits.length > 15) {
    whatsappInput.setCustomValidity("Enter a valid phone number");
    whatsappError.textContent = "Enter a valid phone number";
    fullWhatsappNumberInput.value = "";
    return false;
  }

  whatsappInput.setCustomValidity("");
  whatsappError.textContent = "";
  fullWhatsappNumberInput.value = `${countryCode}${digits}`;
  return true;
}

function hasSelectedExam() {
  return Array.from(examCheckboxes).some((checkbox) => checkbox.checked);
}

function getSelectedExams() {
  return Array.from(examCheckboxes)
    .filter((checkbox) => checkbox.checked)
    .map((checkbox) => checkbox.value);
}

function updateExamValidation() {
  if (hasSelectedExam()) {
    examError.textContent = "";
    return true;
  }

  examError.textContent = "Please select at least one target exam.";
  return false;
}

examCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener("change", updateExamValidation);
});

countryCodeSelect.addEventListener("change", () => {
  syncPhoneInputLimit();
  validateWhatsappNumber();
});

whatsappInput.addEventListener("input", () => {
  const maxLength = getPhoneMaxLength(countryCodeSelect.value);
  whatsappInput.value = sanitizePhoneNumber(whatsappInput.value).slice(0, maxLength);
  validateWhatsappNumber();
});

whatsappInput.addEventListener("blur", validateWhatsappNumber);

syncPhoneInputLimit();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  validateWhatsappNumber();
  const inputsAreValid = form.reportValidity();
  const examsAreValid = updateExamValidation();

  if (!inputsAreValid || !examsAreValid) {
    return;
  }

  const selectedExams = getSelectedExams();
  const examParam = selectedExams.join(",");

  window.location.href = `result.html?exam=${encodeURIComponent(examParam)}`;
});
