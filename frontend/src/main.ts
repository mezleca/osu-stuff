import './css/index.css';

document.addEventListener("DOMContentLoaded", () => {

	const tabs = document.querySelectorAll(".tab");
	const tab_contents = document.querySelectorAll(".tab-content");
	const expand_buttons = document.querySelectorAll(".expand-btn");
	const search_expandeds = document.querySelectorAll(".search-expanded");

	const switch_tab = (id: string | null) => {
		tabs.forEach((tab) => tab.classList.remove("active"));
		tab_contents.forEach((content) => content.classList.remove("active"));
		document.querySelector(`.tab[data-tab="${id}"]`)?.classList.add("active");
		document.getElementById(`${id}-content`)?.classList.add("active");
	};

	tabs.forEach((tab: Element) => {
		tab.addEventListener("click", () => {
			switch_tab(tab.getAttribute("data-tab"));
		});
	});

	expand_buttons.forEach((btn: Element, index: number) => {
		btn.addEventListener("click", () => {
			btn.classList.toggle("active");
			search_expandeds[index].classList.toggle("active");
		});
	});
});